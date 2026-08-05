import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AppointmentService } from '../appointment/appointment.service';
import { Appointment, AppointmentStatus, AppointmentType } from '../appointment/entities/appointment.entity';
import { Booking, BookingType } from '../scheduling/entities/booking.entity';
import { StreamSlot } from '../scheduling/entities/stream-slot.entity';
import { Wave } from '../scheduling/entities/wave.entity';
import {
  AvailabilityByDateResponse,
  CustomAvailabilityResponse,
  CustomAvailabilityWithSummary,
  RecurringAvailabilityResponse,
  RecurringAvailabilityWithSummary,
} from './availability-response.types';
import { CreateCustomAvailabilityDto } from './dto/create-custom-availability.dto';
import { CreateRecurringAvailabilityDto } from './dto/create-recurring-availability.dto';
import { UpdateRecurringAvailabilityDto } from './dto/update-recurring-availability.dto';
import { UpdateCustomAvailabilityDto } from './dto/update-custom-availability.dto';
import { AvailabilityType } from './availability-type.enum';
import { CustomAvailability } from './entities/custom-availability.entity';
import {
  DayOfWeek,
  RecurringAvailability,
  SchedulingType,
} from './entities/recurring-availability.entity';

@Injectable()
export class AvailabilityService {
  constructor(
    @InjectRepository(RecurringAvailability)
    private readonly recurringRepo: Repository<RecurringAvailability>,
    @InjectRepository(CustomAvailability)
    private readonly customRepo: Repository<CustomAvailability>,
    @InjectRepository(StreamSlot)
    private readonly streamSlotRepo: Repository<StreamSlot>,
    @InjectRepository(Wave)
    private readonly waveRepo: Repository<Wave>,
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,
    private readonly appointmentService: AppointmentService,
  ) {}

  

  async createRecurring(
    doctorId: string,
    dto: CreateRecurringAvailabilityDto,
  ): Promise<RecurringAvailabilityWithSummary> {
    this.validateTimeRange(dto.startTime, dto.endTime);

    const existing = await this.recurringRepo.find({
      where: { doctorId, dayOfWeek: dto.dayOfWeek },
    });
    this.checkOverlaps(existing, dto.startTime, dto.endTime);

    if (dto.schedulingType === SchedulingType.WAVE && !dto.slotDuration) {
      throw new BadRequestException('slotDuration is required for WAVE scheduling');
    }

    const availability = this.recurringRepo.create({
      doctorId,
      dayOfWeek: dto.dayOfWeek,
      startTime: dto.startTime,
      endTime: dto.endTime,
      schedulingType: dto.schedulingType,
      slotDuration: dto.schedulingType === SchedulingType.WAVE ? dto.slotDuration! : null,
      maxCapacity: dto.maxCapacity,
    });

    const saved = await this.recurringRepo.save(availability);

    const sessionMins = this.timeToMinutes(dto.endTime) - this.timeToMinutes(dto.startTime);

    return {
      ...this.formatRecurringAvailability(saved),
      summary:
        dto.schedulingType === SchedulingType.STREAM
          ? `STREAM: ${dto.startTime}–${dto.endTime} (${sessionMins} min) → up to ${dto.maxCapacity} patients`
          : `WAVE: ${dto.startTime}–${dto.endTime} (${sessionMins} min) → ${Math.floor(sessionMins / dto.slotDuration!)} waves of ${dto.slotDuration} min, ${dto.maxCapacity} patients each`,
    };
  }

  async getRecurring(doctorId: string): Promise<RecurringAvailabilityResponse[]> {
    const items = await this.recurringRepo.find({
      where: { doctorId },
      order: { dayOfWeek: 'ASC', startTime: 'ASC' },
    });
    return items.map((item) => this.formatRecurringAvailability(item));
  }

  async getRecurringById(doctorId: string, id: string): Promise<RecurringAvailabilityResponse> {
    const availability = await this.recurringRepo.findOne({
      where: { id, doctorId },
    });

    if (!availability) {
      throw new NotFoundException('Recurring availability not found');
    }

    return this.formatRecurringAvailability(availability);
  }
  async updateRecurring(
    doctorId: string,
    id: string,
    dto: UpdateRecurringAvailabilityDto,
  ): Promise<object> {
    const availability = await this.recurringRepo.findOne({ where: { id, doctorId } });
    if (!availability) throw new NotFoundException('Recurring availability not found');

    const newStart = dto.startTime ?? availability.startTime;
    const newEnd   = dto.endTime   ?? availability.endTime;
    const newDay   = dto.dayOfWeek ?? availability.dayOfWeek;

    this.validateTimeRange(newStart, newEnd);

    const others = (await this.recurringRepo.find({ where: { doctorId, dayOfWeek: newDay } }))
      .filter((r) => r.id !== id);
    this.checkOverlaps(others, newStart, newEnd);

    // ── Detect shrink vs expand ───────────────────────────────────────────────
    const oldStartMin = this.timeToMinutes(availability.startTime);
    const oldEndMin   = this.timeToMinutes(availability.endTime);
    const newStartMin = this.timeToMinutes(newStart);
    const newEndMin   = this.timeToMinutes(newEnd);

    const isShrink =
      newStartMin > oldStartMin || newEndMin < oldEndMin;
    const isExpand =
      newStartMin < oldStartMin || newEndMin > oldEndMin;

    // Save the updated availability first
    Object.assign(availability, dto);
    const saved = await this.recurringRepo.save(availability);
    const formatted = this.formatRecurringAvailability(saved);

    // ── EXPAND ────────────────────────────────────────────────────────────────
    if (isExpand && !isShrink) {
      return {
        ...formatted,
        elasticAction: 'EXPAND',
        message: 'Availability expanded. Regenerate slots for affected dates to open new booking windows.',
      };
    }

    // ── SHRINK ────────────────────────────────────────────────────────────────
    if (isShrink) {
      return this.handleShrinkForRecurring(doctorId, newDay, availability.schedulingType, newStart, newEnd, formatted);
    }
    // No time change (e.g. only maxCapacity or schedulingType changed)
    return { ...formatted, elasticAction: 'NO_TIME_CHANGE' };
  }


  private async handleShrinkForRecurring(
    doctorId: string,
    dayOfWeek: DayOfWeek,
    schedulingType: SchedulingType,
    newStart: string,
    newEnd: string,
    formattedAvailability: RecurringAvailabilityResponse,
  ): Promise<object> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Collect all future dates matching this dayOfWeek
    const futureDates = await this.getFutureDatesForDayOfWeek(dayOfWeek, 60);

    const affectedAppointments: object[] = [];
    const autoMoved: object[] = [];
    const needsReschedule: object[] = [];

    for (const date of futureDates) {
      if (schedulingType === SchedulingType.STREAM) {
        // Find stream slots outside the new window
        const slots = await this.streamSlotRepo.find({ where: { doctorId, date } });
        for (const slot of slots) {
          const slotStartMin = this.timeToMinutes(slot.startTime);
          const slotEndMin   = this.timeToMinutes(slot.endTime);
          const newStartMin  = this.timeToMinutes(newStart);
          const newEndMin    = this.timeToMinutes(newEnd);
          const isOutside    = slotStartMin < newStartMin || slotEndMin > newEndMin;

          if (!isOutside) continue;

          // Find booked appointments on this slot
          const appts = await this.appointmentService.findAppointmentsBySlotId(slot.id);
          for (const appt of appts) {
            affectedAppointments.push(appt);
            // Try to find another available slot on the same date inside the new window
            const moved = await this.tryAutoMoveStream(appt, doctorId, date, newStart, newEnd);
            if (moved) {
              autoMoved.push(moved);
            } else {
              needsReschedule.push({
                appointmentId: appt.id,
                patientId: appt.patientId,
                date,
                reason: 'No available slot within the new availability window',
                action: 'NEEDS_RESCHEDULE',
              });
            }
          }
        }
      } else {
        // WAVE: find waves outside the new window
        const waves = await this.waveRepo.find({ where: { doctorId, date } });
        for (const wave of waves) {
          const waveStartMin = this.timeToMinutes(wave.startTime);
          const waveEndMin   = this.timeToMinutes(wave.endTime);
          const newStartMin  = this.timeToMinutes(newStart);
          const newEndMin    = this.timeToMinutes(newEnd);
          const isOutside    = waveStartMin < newStartMin || waveEndMin > newEndMin;

          if (!isOutside) continue;

          const appts = await this.appointmentService.findAppointmentsByWaveId(wave.id);
          for (const appt of appts) {
            affectedAppointments.push(appt);
            const moved = await this.tryAutoMoveWave(appt, doctorId, date, newStart, newEnd);
            if (moved) {
              autoMoved.push(moved);
            } else {
              needsReschedule.push({
                appointmentId: appt.id,
                patientId: appt.patientId,
                date,
                reason: 'No available wave within the new availability window',
                action: 'NEEDS_RESCHEDULE',
              });
            }
          }
        }
      }
    }

    return {
      ...formattedAvailability,
      elasticAction: 'SHRINK',
      summary: {
        totalAffected: affectedAppointments.length,
        autoMoved: autoMoved.length,
        needsReschedule: needsReschedule.length,
      },
      autoMoved,
      needsReschedule,
      message:
        affectedAppointments.length === 0
          ? 'Availability shrunk. No existing appointments were affected.'
          : `Availability shrunk. ${autoMoved.length} appointment(s) auto-moved, ${needsReschedule.length} need manual reschedule.`,
    };
  }

  /**
   * Elastic update for a specific custom (date-based) availability.
   * Same shrink/expand logic but operates on a single date's slots.
   */
  async updateCustom(
    doctorId: string,
    id: string,
    dto: UpdateCustomAvailabilityDto,
  ): Promise<object> {
    const availability = await this.customRepo.findOne({ where: { id, doctorId } });
    if (!availability) throw new NotFoundException('Custom availability not found');

    const newStart = dto.startTime ?? availability.startTime;
    const newEnd   = dto.endTime   ?? availability.endTime;

    this.validateTimeRange(newStart, newEnd);

    const others = (await this.customRepo.find({ where: { doctorId, date: availability.date } }))
      .filter((c) => c.id !== id);
    this.checkOverlaps(others, newStart, newEnd);

    const oldStartMin = this.timeToMinutes(availability.startTime);
    const oldEndMin   = this.timeToMinutes(availability.endTime);
    const newStartMin = this.timeToMinutes(newStart);
    const newEndMin   = this.timeToMinutes(newEnd);

    const isShrink = newStartMin > oldStartMin || newEndMin < oldEndMin;
    const isExpand = newStartMin < oldStartMin || newEndMin > oldEndMin;

    Object.assign(availability, dto);
    const saved = await this.customRepo.save(availability);
    const formatted = this.formatCustomAvailability(saved);

    if (isExpand && !isShrink) {
      return {
        ...formatted,
        elasticAction: 'EXPAND',
        message: 'Availability expanded. Regenerate slots for this date to open new booking windows.',
      };
    }

    if (isShrink) {
      return this.handleShrinkForCustom(doctorId, availability.date, availability.schedulingType, newStart, newEnd, formatted);
    }

    return { ...formatted, elasticAction: 'NO_TIME_CHANGE' };
  }

  private async handleShrinkForCustom(
    doctorId: string,
    date: string,
    schedulingType: SchedulingType,
    newStart: string,
    newEnd: string,
    formattedAvailability: CustomAvailabilityResponse,
  ): Promise<object> {
    const affectedAppointments: object[] = [];
    const autoMoved: object[] = [];
    const needsReschedule: object[] = [];

    if (schedulingType === SchedulingType.STREAM) {
      const slots = await this.streamSlotRepo.find({ where: { doctorId, date } });
      for (const slot of slots) {
        const isOutside =
          this.timeToMinutes(slot.startTime) < this.timeToMinutes(newStart) ||
          this.timeToMinutes(slot.endTime)   > this.timeToMinutes(newEnd);
        if (!isOutside) continue;

        const appts = await this.appointmentService.findAppointmentsBySlotId(slot.id);
        for (const appt of appts) {
          affectedAppointments.push(appt);
          const moved = await this.tryAutoMoveStream(appt, doctorId, date, newStart, newEnd);
          if (moved) {
            autoMoved.push(moved);
          } else {
            needsReschedule.push({
              appointmentId: appt.id,
              patientId: appt.patientId,
              date,
              reason: 'No available slot within new availability window',
              action: 'NEEDS_RESCHEDULE',
            });
          }
        }
      }
    } else {
      const waves = await this.waveRepo.find({ where: { doctorId, date } });
      for (const wave of waves) {
        const isOutside =
          this.timeToMinutes(wave.startTime) < this.timeToMinutes(newStart) ||
          this.timeToMinutes(wave.endTime)   > this.timeToMinutes(newEnd);
        if (!isOutside) continue;

        const appts = await this.appointmentService.findAppointmentsByWaveId(wave.id);
        for (const appt of appts) {
          affectedAppointments.push(appt);
          const moved = await this.tryAutoMoveWave(appt, doctorId, date, newStart, newEnd);
          if (moved) {
            autoMoved.push(moved);
          } else {
            needsReschedule.push({
              appointmentId: appt.id,
              patientId: appt.patientId,
              date,
              reason: 'No available wave within new availability window',
              action: 'NEEDS_RESCHEDULE',
            });
          }
        }
      }
    }

    return {
      ...formattedAvailability,
      elasticAction: 'SHRINK',
      summary: {
        totalAffected: affectedAppointments.length,
        autoMoved: autoMoved.length,
        needsReschedule: needsReschedule.length,
      },
      autoMoved,
      needsReschedule,
      message:
        affectedAppointments.length === 0
          ? 'Availability shrunk. No existing appointments were affected.'
          : `Availability shrunk. ${autoMoved.length} appointment(s) auto-moved, ${needsReschedule.length} need manual reschedule.`,
    };
  }

  async deleteRecurring(doctorId: string, id: string) {
    const availability = await this.recurringRepo.findOne({ where: { id, doctorId } });

    if (!availability) {
      throw new NotFoundException('Recurring availability not found');
    }

    await this.recurringRepo.remove(availability);
    return { message: 'Recurring availability deleted successfully' };
  }

  

  async createCustom(
    doctorId: string,
    dto: CreateCustomAvailabilityDto,
  ): Promise<CustomAvailabilityWithSummary> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (new Date(dto.date) < today) {
      throw new BadRequestException('Cannot create availability for past dates');
    }

    this.validateTimeRange(dto.startTime, dto.endTime);

    const existing = await this.customRepo.find({
      where: { doctorId, date: dto.date },
    });
    this.checkOverlaps(existing, dto.startTime, dto.endTime);

    if (dto.schedulingType === SchedulingType.WAVE && !dto.slotDuration) {
      throw new BadRequestException('slotDuration is required for WAVE scheduling');
    }

    const availability = this.customRepo.create({
      doctorId,
      date: dto.date,
      startTime: dto.startTime,
      endTime: dto.endTime,
      schedulingType: dto.schedulingType,
      slotDuration: dto.schedulingType === SchedulingType.WAVE ? dto.slotDuration! : null,
      maxCapacity: dto.maxCapacity,
    });

    const saved = await this.customRepo.save(availability);

    const sessionMins = this.timeToMinutes(dto.endTime) - this.timeToMinutes(dto.startTime);

    return {
      ...this.formatCustomAvailability(saved),
      summary:
        dto.schedulingType === SchedulingType.STREAM
          ? `STREAM: ${dto.startTime}–${dto.endTime} (${sessionMins} min) → up to ${dto.maxCapacity} patients`
          : `WAVE: ${dto.startTime}–${dto.endTime} (${sessionMins} min) → ${Math.floor(sessionMins / dto.slotDuration!)} waves of ${dto.slotDuration} min, ${dto.maxCapacity} patients each`,
    };
  }

  async getAvailabilityByDate(doctorId: string, date: string): Promise<AvailabilityByDateResponse> {
    const custom = await this.customRepo.find({
      where: { doctorId, date },
      order: { startTime: 'ASC' },
    });

    if (custom.length > 0) {
      return {
        date,
        availabilityType: AvailabilityType.CUSTOM,
        availability: custom.map((c) => this.formatCustomAvailability(c)),
      };
    }

    const dayOfWeek = this.getDayOfWeek(date);
    const recurring = await this.recurringRepo.find({
      where: { doctorId, dayOfWeek },
      order: { startTime: 'ASC' },
    });

    if (recurring.length === 0) {
      return { date, availabilityType: null, message: 'No availability found for this date' };
    }

    return {
      date,
      availabilityType: AvailabilityType.RECURRING,
      dayOfWeek,
      availability: recurring.map((r) => this.formatRecurringAvailability(r)),
    };
  }

  private formatRecurringAvailability(avail: RecurringAvailability): RecurringAvailabilityResponse {
    const response: RecurringAvailabilityResponse = {
      id: avail.id,
      availabilityType: AvailabilityType.RECURRING,
      dayOfWeek: avail.dayOfWeek,
      startTime: avail.startTime,
      endTime: avail.endTime,
      schedulingType: avail.schedulingType,
      maxCapacity: avail.maxCapacity ?? 1,
      createdAt: avail.createdAt,
      updatedAt: avail.updatedAt,
    };

    if (avail.schedulingType === SchedulingType.WAVE) {
      response.slotDuration = avail.slotDuration;
    }

    return response;
  }

  private formatCustomAvailability(avail: CustomAvailability): CustomAvailabilityResponse {
    const response: CustomAvailabilityResponse = {
      id: avail.id,
      availabilityType: AvailabilityType.CUSTOM,
      date: avail.date,
      startTime: avail.startTime,
      endTime: avail.endTime,
      schedulingType: avail.schedulingType,
      maxCapacity: avail.maxCapacity ?? 1,
      createdAt: avail.createdAt,
      updatedAt: avail.updatedAt,
    };

    if (avail.schedulingType === SchedulingType.WAVE) {
      response.slotDuration = avail.slotDuration;
    }

    return response;
  }

  

  async generateSlotsFromAvailability(doctorId: string, availabilityId: string, date: string) {
  
    let availability: RecurringAvailability | CustomAvailability | null =
      await this.customRepo.findOne({ where: { id: availabilityId, doctorId } });

    if (!availability) {
      availability = await this.recurringRepo.findOne({ where: { id: availabilityId, doctorId } });
    }

    if (!availability) {
      throw new NotFoundException('Availability not found');
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (new Date(date) < today) {
      throw new BadRequestException('Cannot generate slots for past dates');
    }

    if (availability.schedulingType === SchedulingType.STREAM) {
      return this.generateStreamSlots(doctorId, availability, date);
    } else {
      return this.generateWaveSlots(doctorId, availability, date);
    }
  }

  
  private async generateStreamSlots(
    doctorId: string,
    availability: RecurringAvailability | CustomAvailability,
    date: string,
  ) {
    const existing = await this.streamSlotRepo.find({ where: { doctorId, date } });
    if (existing.length > 0) {
      throw new ConflictException(`Stream slots already generated for ${date}`);
    }

    const maxCapacity = availability.maxCapacity ?? 1;
    const sessionMins =
      this.timeToMinutes(availability.endTime) - this.timeToMinutes(availability.startTime);

    // STREAM = one single bookable slot covering the entire session window
    const slot = new StreamSlot();
    slot.doctorId = doctorId;
    slot.date = date;
    slot.startTime = availability.startTime;
    slot.endTime = availability.endTime;
    slot.maxCapacity = maxCapacity;
    slot.bookedCount = 0;
    slot.isBooked = false;
    slot.patientId = null;

    const saved = await this.streamSlotRepo.save(slot);

    return {
      schedulingType: 'STREAM',
      date,
      summary: `STREAM: ${availability.startTime}–${availability.endTime} (${sessionMins} min) → up to ${maxCapacity} patients`,
      totalSlots: 1,
      slots: [
        {
          id: saved.id,
          startTime: saved.startTime,
          endTime: saved.endTime,
          maxCapacity: saved.maxCapacity,
          bookedCount: saved.bookedCount,
          remainingCapacity: saved.maxCapacity - saved.bookedCount,
          isAvailable: saved.bookedCount < saved.maxCapacity,
        },
      ],
    };
  }

  private async generateWaveSlots(
    doctorId: string,
    availability: RecurringAvailability | CustomAvailability,
    date: string,
  ) {
    const existingWaves = await this.waveRepo.find({
      where: { doctorId, date, startTime: availability.startTime },
    });
    if (existingWaves.length > 0) {
      throw new ConflictException(`Wave already exists for ${date} at ${availability.startTime}`);
    }

    const slotDuration = availability.slotDuration;
    const maxCapacity = availability.maxCapacity;

    if (!slotDuration || slotDuration <= 0) {
      throw new BadRequestException('slotDuration is required to generate wave slots');
    }
    if (!maxCapacity || maxCapacity <= 0) {
      throw new BadRequestException('maxCapacity is required to generate wave slots');
    }

    const waves: Wave[] = [];
    let current = this.timeToMinutes(availability.startTime);
    const end = this.timeToMinutes(availability.endTime);

    while (current + slotDuration <= end) {
      const wave = this.waveRepo.create({
        doctorId,
        date,
        startTime: this.minutesToTime(current),
        endTime: this.minutesToTime(current + slotDuration),
        maxPatients: maxCapacity,
        bookedCount: 0,
      });
      waves.push(wave);
      current += slotDuration;
    }

    if (waves.length === 0) {
      throw new BadRequestException('Session too short to generate any wave slots');
    }

    const saved = await this.waveRepo.save(waves);
    const sessionMins = this.timeToMinutes(availability.endTime) - this.timeToMinutes(availability.startTime);

    return {
      schedulingType: 'WAVE',
      date,
      summary: `WAVE: ${availability.startTime}–${availability.endTime} (${sessionMins} min) → ${saved.length} waves of ${slotDuration} min, ${maxCapacity} patients each`,
      totalSlots: saved.length,
      waves: saved.map((w) => ({
        id: w.id,
        startTime: w.startTime,
        endTime: w.endTime,
        maxCapacity: w.maxPatients,
        bookedCount: w.bookedCount,
        remainingCapacity: w.maxPatients - w.bookedCount,
        isFull: w.bookedCount >= w.maxPatients,
      })),
    };
  }


  async getGeneratedSlots(doctorId: string, date: string) {
    const streamSlots = await this.streamSlotRepo.find({
      where: { doctorId, date },
      order: { startTime: 'ASC' },
    });

    const waves = await this.waveRepo.find({
      where: { doctorId, date },
      order: { startTime: 'ASC' },
    });

    if (streamSlots.length > 0) {
      return {
        doctorId,
        date,
        schedulingType: 'STREAM',
        slots: streamSlots.map((s) => ({
          id: s.id,
          startTime: s.startTime,
          endTime: s.endTime,
          maxCapacity: s.maxCapacity,
          remainingCapacity: s.maxCapacity - s.bookedCount,
          isAvailable: s.bookedCount < s.maxCapacity,
        })),
      };
    }

    if (waves.length > 0) {
      return {
        doctorId,
        date,
        schedulingType: 'WAVE',
        waves: waves.map((w) => ({
          id: w.id,
          startTime: w.startTime,
          endTime: w.endTime,
          maxCapacity: w.maxPatients,
          remainingCapacity: w.maxPatients - w.bookedCount,
          isFull: w.bookedCount >= w.maxPatients,
        })),
      };
    }

    return { doctorId, date, message: 'No slots generated for this date' };
  }

 

  async bookStreamSlot(patientId: string, streamSlotId: string, doctorId: string) {
    const slot = await this.streamSlotRepo.findOne({ where: { id: streamSlotId, doctorId } });

    if (!slot) throw new NotFoundException('Stream slot not found');

    if (slot.bookedCount >= slot.maxCapacity) {
      throw new ConflictException('This slot is fully booked');
    }

    const existingBooking = await this.bookingRepo.findOne({
      where: { patientId, streamSlotId, bookingType: BookingType.STREAM },
    });
    if (existingBooking) throw new ConflictException('You already booked this slot');

    slot.bookedCount += 1;
    slot.isBooked = slot.bookedCount >= slot.maxCapacity;
    slot.patientId = patientId;
    await this.streamSlotRepo.save(slot);

    const booking = this.bookingRepo.create({
      patientId, doctorId,
      bookingType: BookingType.STREAM,
      date: slot.date,
      streamSlotId: slot.id,
      slotStartTime: slot.startTime,
      slotEndTime: slot.endTime,
    });

    const saved = await this.bookingRepo.save(booking);

    return {
      bookingId: saved.id,
      schedulingType: 'STREAM',
      date: slot.date,
      appointmentTime: `${slot.startTime} – ${slot.endTime}`,
      remainingCapacity: slot.maxCapacity - slot.bookedCount,
      message: 'Stream appointment booked successfully',
    };
  }

  

  async bookWaveSlot(patientId: string, waveId: string, doctorId: string) {
    const wave = await this.waveRepo.findOne({ where: { id: waveId, doctorId } });

    if (!wave) throw new NotFoundException('Wave slot not found');

    if (wave.bookedCount >= wave.maxPatients) {
      throw new ConflictException('This wave slot is full');
    }

    const existingBooking = await this.bookingRepo.findOne({
      where: { patientId, waveId, bookingType: BookingType.WAVE },
    });
    if (existingBooking) throw new ConflictException('You already booked this wave');

    const tokenNumber = wave.bookedCount + 1;
    wave.bookedCount += 1;
    await this.waveRepo.save(wave);

    const booking = this.bookingRepo.create({
      patientId, doctorId,
      bookingType: BookingType.WAVE,
      date: wave.date,
      waveId: wave.id,
      waveStartTime: wave.startTime,
      waveEndTime: wave.endTime,
      tokenNumber,
    });

    const saved = await this.bookingRepo.save(booking);

    return {
      bookingId: saved.id,
      schedulingType: 'WAVE',
      date: wave.date,
      timeWindow: `${wave.startTime} – ${wave.endTime}`,
      tokenNumber,
      remainingCapacity: wave.maxPatients - wave.bookedCount,
      message: `Wave booked. Your token number is ${tokenNumber}`,
    };
  }



 
  private async tryAutoMoveStream(
    appt: Appointment,
    doctorId: string,
    date: string,
    newStart: string,
    newEnd: string,
  ): Promise<object | null> {
    const newStartMin = this.timeToMinutes(newStart);
    const newEndMin   = this.timeToMinutes(newEnd);

    const candidates = await this.streamSlotRepo.find({
      where: { doctorId, date },
      order: { startTime: 'ASC' },
    });

    for (const slot of candidates) {
      if (slot.id === appt.streamSlotId) continue; // skip current slot
      if (this.timeToMinutes(slot.startTime) < newStartMin) continue;
      if (this.timeToMinutes(slot.endTime)   > newEndMin)   continue;
      if (slot.bookedCount >= slot.maxCapacity) continue;

      // Move appointment to this slot
      await this.appointmentService.moveAppointmentToSlot(appt.id, slot);

      return {
        appointmentId: appt.id,
        patientId: appt.patientId,
        date,
        newSlotId: slot.id,
        newTime: `${slot.startTime} – ${slot.endTime}`,
        action: 'AUTO_MOVED',
      };
    }

    return null;
  }

  /**
   * Tries to move a WAVE appointment to another available wave on the same
   * date that falls within the new availability window.
   */
  private async tryAutoMoveWave(
    appt: Appointment,
    doctorId: string,
    date: string,
    newStart: string,
    newEnd: string,
  ): Promise<object | null> {
    const newStartMin = this.timeToMinutes(newStart);
    const newEndMin   = this.timeToMinutes(newEnd);

    const candidates = await this.waveRepo.find({
      where: { doctorId, date },
      order: { startTime: 'ASC' },
    });

    for (const wave of candidates) {
      if (wave.id === appt.waveId) continue;
      if (this.timeToMinutes(wave.startTime) < newStartMin) continue;
      if (this.timeToMinutes(wave.endTime)   > newEndMin)   continue;
      if (wave.bookedCount >= wave.maxPatients) continue;

      // Move appointment to this wave
      await this.appointmentService.moveAppointmentToWave(appt.id, wave);

      return {
        appointmentId: appt.id,
        patientId: appt.patientId,
        date,
        newWaveId: wave.id,
        newTimeWindow: `${wave.startTime} – ${wave.endTime}`,
        action: 'AUTO_MOVED',
      };
    }

    return null;
  }

  
  private getFutureDatesForDayOfWeek(dayOfWeek: DayOfWeek, days: number): string[] {
    const dayIndex: Record<DayOfWeek, number> = {
      [DayOfWeek.SUNDAY]: 0,
      [DayOfWeek.MONDAY]: 1,
      [DayOfWeek.TUESDAY]: 2,
      [DayOfWeek.WEDNESDAY]: 3,
      [DayOfWeek.THURSDAY]: 4,
      [DayOfWeek.FRIDAY]: 5,
      [DayOfWeek.SATURDAY]: 6,
    };

    const target = dayIndex[dayOfWeek];
    const dates: string[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i <= days; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      if (d.getDay() === target) {
        dates.push(d.toISOString().split('T')[0]);
      }
    }

    return dates;
  }

  // ─── Private helpers ─────────────────────────────────────────────────────────

  private validateTimeRange(startTime: string, endTime: string): void {
    if (this.timeToMinutes(startTime) >= this.timeToMinutes(endTime)) {
      throw new BadRequestException(
        `Invalid time range: startTime (${startTime}) must be before endTime (${endTime})`,
      );
    }
  }

  private checkOverlaps(
    existing: Array<{ startTime: string; endTime: string }>,
    newStart: string,
    newEnd: string,
  ) {
    const ns = this.timeToMinutes(newStart);
    const ne = this.timeToMinutes(newEnd);

    for (const slot of existing) {
      const es = this.timeToMinutes(slot.startTime);
      const ee = this.timeToMinutes(slot.endTime);
      if (ns < ee && ne > es) {
        throw new ConflictException(
          `Availability ${newStart}-${newEnd} overlaps with existing slot ${slot.startTime}-${slot.endTime}`,
        );
      }
    }
  }

  private timeToMinutes(time: string): number {
    const parts = time.split(':').map(Number);
    return parts[0] * 60 + parts[1];
  }

  private minutesToTime(minutes: number): string {
    const h = Math.floor(minutes / 60).toString().padStart(2, '0');
    const m = (minutes % 60).toString().padStart(2, '0');
    return `${h}:${m}`;
  }

  private getDayOfWeek(dateStr: string): DayOfWeek {
    const days: DayOfWeek[] = [
      DayOfWeek.SUNDAY, DayOfWeek.MONDAY, DayOfWeek.TUESDAY,
      DayOfWeek.WEDNESDAY, DayOfWeek.THURSDAY, DayOfWeek.FRIDAY, DayOfWeek.SATURDAY,
    ];
    return days[new Date(dateStr).getDay()];
  }
}
