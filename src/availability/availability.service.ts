import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Booking, BookingType } from '../scheduling/entities/booking.entity';
import { StreamSlot } from '../scheduling/entities/stream-slot.entity';
import { Wave } from '../scheduling/entities/wave.entity';
import { CreateCustomAvailabilityDto } from './dto/create-custom-availability.dto';
import { CreateRecurringAvailabilityDto } from './dto/create-recurring-availability.dto';
import { UpdateRecurringAvailabilityDto } from './dto/update-recurring-availability.dto';
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
  ) {}

  

  async createRecurring(doctorId: string, dto: CreateRecurringAvailabilityDto) {
    this.validateTimeRange(dto.startTime, dto.endTime);

    
    const existing = await this.recurringRepo.find({
      where: { doctorId, dayOfWeek: dto.dayOfWeek },
    });
    this.checkOverlaps(existing, dto.startTime, dto.endTime);

    
    let calculatedMaxCapacity = dto.maxCapacity;
    if (dto.schedulingType === SchedulingType.STREAM) {
      const sessionMins = this.timeToMinutes(dto.endTime) - this.timeToMinutes(dto.startTime);
      const totalSlotTime = dto.slotDuration;
      calculatedMaxCapacity = Math.floor(sessionMins / totalSlotTime);

      if (calculatedMaxCapacity === 0) {
        throw new BadRequestException(
          `Session too short to fit even one ${dto.slotDuration} min slot`,
        );
      }
    }

    const availability = this.recurringRepo.create({
      doctorId,
      dayOfWeek: dto.dayOfWeek,
      startTime: dto.startTime,
      endTime: dto.endTime,
      schedulingType: dto.schedulingType,
      slotDuration: dto.slotDuration,
      maxCapacity: calculatedMaxCapacity,
      bufferTime: dto.bufferTime ?? 0,
    });

    const saved = await this.recurringRepo.save(availability);

    return {
      ...saved,
      ...(dto.schedulingType === SchedulingType.STREAM && {
        calculatedMaxPatients: calculatedMaxCapacity,
        summary: `Session: ${dto.startTime}–${dto.endTime} (${this.timeToMinutes(dto.endTime) - this.timeToMinutes(dto.startTime)} min) → ${calculatedMaxCapacity} slots of ${dto.slotDuration} min`,
      }),
    };
  }

  async getRecurring(doctorId: string) {
    return this.recurringRepo.find({
      where: { doctorId },
      order: { dayOfWeek: 'ASC', startTime: 'ASC' },
    });
  }


  async getRecurringById(doctorId: string, id: string) {
  const availability = await this.recurringRepo.findOne({
    where: {
      id,
      doctorId,
    },
  });

  if (!availability) {
    throw new NotFoundException('Recurring availability not found');
  }

  return availability;
}
  async updateRecurring(doctorId: string, id: string, dto: UpdateRecurringAvailabilityDto) {
    const availability = await this.recurringRepo.findOne({ where: { id, doctorId } });

    if (!availability) {
      throw new NotFoundException('Recurring availability not found');
    }

    const updatedStartTime = dto.startTime ?? availability.startTime;
    const updatedEndTime = dto.endTime ?? availability.endTime;
    const updatedDayOfWeek = dto.dayOfWeek ?? availability.dayOfWeek;

    this.validateTimeRange(updatedStartTime, updatedEndTime);

    const existing = await this.recurringRepo.find({
      where: { doctorId, dayOfWeek: updatedDayOfWeek },
    });
    const filtered = existing.filter((item) => item.id !== id);
    this.checkOverlaps(filtered, updatedStartTime, updatedEndTime);

    Object.assign(availability, dto);
    return this.recurringRepo.save(availability);
  }

  async deleteRecurring(doctorId: string, id: string) {
    const availability = await this.recurringRepo.findOne({ where: { id, doctorId } });

    if (!availability) {
      throw new NotFoundException('Recurring availability not found');
    }

    await this.recurringRepo.remove(availability);
    return { message: 'Recurring availability deleted successfully' };
  }

  

  async createCustom(doctorId: string, dto: CreateCustomAvailabilityDto) {
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

    
    let calculatedMaxCapacity = dto.maxCapacity;
    if (dto.schedulingType === SchedulingType.STREAM) {
      const sessionMins = this.timeToMinutes(dto.endTime) - this.timeToMinutes(dto.startTime);
      const totalSlotTime = dto.slotDuration + (dto.bufferTime ?? 0);
      calculatedMaxCapacity = Math.floor(sessionMins / totalSlotTime);

      if (calculatedMaxCapacity === 0) {
        throw new BadRequestException(
          `Session too short to fit even one ${dto.slotDuration} min slot`,
        );
      }
    }

    const availability = this.customRepo.create({
      doctorId,
      date: dto.date,
      startTime: dto.startTime,
      endTime: dto.endTime,
      schedulingType: dto.schedulingType,
      slotDuration: dto.slotDuration,
      maxCapacity: calculatedMaxCapacity,
      bufferTime: dto.bufferTime ?? 0,
    });

    return this.customRepo.save(availability);
  }

  

  async getAvailabilityByDate(doctorId: string, date: string) {
    const custom = await this.customRepo.find({
      where: { doctorId, date },
      order: { startTime: 'ASC' },
    });

    if (custom.length > 0) {
      return {
        date,
        type: 'custom',
        availability: custom.map((c) => this.formatAvailability(c)),
      };
    }

    const dayOfWeek = this.getDayOfWeek(date);
    const recurring = await this.recurringRepo.find({
      where: { doctorId, dayOfWeek },
      order: { startTime: 'ASC' },
    });

    if (recurring.length === 0) {
      return { date, type: 'none', message: 'No availability found for this date' };
    }

    return {
      date,
      type: 'recurring',
      dayOfWeek,
      availability: recurring.map((r) => this.formatAvailability(r)),
    };
  }

  private formatAvailability(avail: RecurringAvailability | CustomAvailability) {
    return {
      id: avail.id,
      startTime: avail.startTime,
      endTime: avail.endTime,
      schedulingType: avail.schedulingType,
      slotDuration: avail.slotDuration,
      maxCapacity: avail.maxCapacity,
      bufferTime: avail.bufferTime,
    };
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

    const slotDuration = availability.slotDuration;
    if (slotDuration == null || slotDuration <= 0) {
      throw new BadRequestException('Slot duration is required to generate stream slots');
    }
    const buffer = availability.bufferTime ?? 0;
    const maxCapacity = availability.maxCapacity;
    if (maxCapacity == null) {
      throw new BadRequestException('Max capacity is required to generate stream slots');
    }
    const totalSlotTime = slotDuration + buffer;

    const slots: StreamSlot[] = [];
    let current = this.timeToMinutes(availability.startTime);
    const end = this.timeToMinutes(availability.endTime);

    while (current + slotDuration <= end) {
      const slot = this.streamSlotRepo.create({
        doctorId,
        date,
        startTime: this.minutesToTime(current),
        endTime: this.minutesToTime(current + slotDuration),
        maxCapacity,
        bookedCount: 0,
        isBooked: false,
        patientId: null,
      });
      slots.push(slot);
      current += totalSlotTime;
    }

    if (slots.length === 0) {
      throw new BadRequestException('Session too short to generate any slots');
    }

    const saved = await this.streamSlotRepo.save(slots);

    return {
      schedulingType: 'STREAM',
      date,
      slotDuration,
      bufferTime: buffer,
      maxCapacityPerSlot: maxCapacity,
      summary: `Session: ${availability.startTime}–${availability.endTime} (${this.timeToMinutes(availability.endTime) - this.timeToMinutes(availability.startTime)} min) → ${saved.length} slots of ${slotDuration} min`,
      totalSlots: saved.length,
      slots: saved.map((s) => ({
        id: s.id,
        startTime: s.startTime,
        endTime: s.endTime,
        maxCapacity: s.maxCapacity,
        bookedCount: s.bookedCount,
        remainingCapacity: s.maxCapacity - s.bookedCount,
        isAvailable: s.bookedCount < s.maxCapacity,
      })),
    };
  }

  // WAVE: divides time window into slots based on duration
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

    // WAVE also divides into slots based on slotDuration
    const slotDuration = availability.slotDuration;
    const maxCapacity = availability.maxCapacity;
    if (slotDuration == null || slotDuration <= 0) {
      throw new BadRequestException('Slot duration is required to generate wave slots');
    }
    if (maxCapacity == null || maxCapacity <= 0) {
      throw new BadRequestException('Max capacity is required to generate wave slots');
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

    return {
      schedulingType: 'WAVE',
      date,
      slotDuration,
      maxCapacityPerSlot: maxCapacity,
      totalSlots: saved.length,
      waves: saved.map((w) => ({
        id: w.id,
        startTime: w.startTime,
        endTime: w.endTime,
        maxPatients: w.maxPatients,
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



  private validateTimeRange(startTime: string, endTime: string) {
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
