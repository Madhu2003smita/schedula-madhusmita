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

    if (dto.schedulingType === SchedulingType.WAVE) {
      if (!dto.maxCapacity) {
        throw new BadRequestException('maxCapacity is required for WAVE scheduling');
      }
      if (!dto.slotDuration) {
        throw new BadRequestException('slotDuration is required for WAVE scheduling');
      }
    }

    const existing = await this.recurringRepo.find({
      where: { doctorId, dayOfWeek: dto.dayOfWeek },
    });
    this.checkOverlaps(existing, dto.startTime, dto.endTime);

    const availability = this.recurringRepo.create({
      doctorId,
      dayOfWeek: dto.dayOfWeek,
      startTime: dto.startTime,
      endTime: dto.endTime,
      schedulingType: dto.schedulingType,
      slotDuration: dto.slotDuration ?? null,
      maxCapacity: dto.maxCapacity ?? null,
    });

    return this.recurringRepo.save(availability);
  }

  async getRecurring(doctorId: string) {
    return this.recurringRepo.find({
      where: { doctorId },
      order: { dayOfWeek: 'ASC', startTime: 'ASC' },
    });
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
    const requestedDate = new Date(dto.date);
    if (requestedDate < today) {
      throw new BadRequestException('Cannot create availability for past dates');
    }

  
    this.validateTimeRange(dto.startTime, dto.endTime);

  
    if (dto.schedulingType === SchedulingType.WAVE) {
      if (!dto.maxCapacity) {
        throw new BadRequestException('maxCapacity is required for WAVE scheduling');
      }
      if (!dto.slotDuration) {
        throw new BadRequestException('slotDuration is required for WAVE scheduling');
      }
    }

    
    const existing = await this.customRepo.find({
      where: { doctorId, date: dto.date },
    });
    this.checkOverlaps(existing, dto.startTime, dto.endTime);

    const availability = this.customRepo.create({
      doctorId,
      date: dto.date,
      startTime: dto.startTime,
      endTime: dto.endTime,
      schedulingType: dto.schedulingType,
      slotDuration: dto.slotDuration ?? null,
      maxCapacity: dto.maxCapacity ?? null,
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
      return {
        date,
        type: 'none',
        message: 'No availability found for this date',
      };
    }

    return {
      date,
      type: 'recurring',
      dayOfWeek,
      availability: recurring.map((r) => this.formatAvailability(r)),
    };
  }

  private formatAvailability(avail: RecurringAvailability | CustomAvailability) {
    if (avail.schedulingType === SchedulingType.STREAM) {
      return {
        id: avail.id,
        startTime: avail.startTime,
        endTime: avail.endTime,
        schedulingType: 'STREAM',
      };
    } else {
      return {
        id: avail.id,
        startTime: avail.startTime,
        endTime: avail.endTime,
        schedulingType: 'WAVE',
        maxCapacity: avail.maxCapacity,
        slotDuration: avail.slotDuration,
      };
    }
  }



  async generateSlotsFromAvailability(doctorId: string, availabilityId: string, date: string) {

    let availability: RecurringAvailability | CustomAvailability | null =
      await this.customRepo.findOne({ where: { id: availabilityId, doctorId } });

    if (!availability) {
      availability = await this.recurringRepo.findOne({
        where: { id: availabilityId, doctorId },
      });
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
      return this.generateWave(doctorId, availability, date);
    }
  }

  private async generateStreamSlots(
    doctorId: string,
    availability: RecurringAvailability | CustomAvailability,
    date: string,
  ) {
  
    const existing = await this.streamSlotRepo.find({
      where: { doctorId, date },
    });
    if (existing.length > 0) {
      throw new ConflictException(`Stream slots already generated for ${date}`);
    }

    
    const slot = this.streamSlotRepo.create({
      doctorId,
      date,
      startTime: availability.startTime,
      endTime: availability.endTime,
      isBooked: false,
      patientId: null,
    });

    const saved = await this.streamSlotRepo.save(slot);

    return {
      schedulingType: 'STREAM',
      date,
      slot: {
        id: saved.id,
        startTime: saved.startTime,
        endTime: saved.endTime,
        isBooked: saved.isBooked,
      },
    };
  }

  private async generateWave(
    doctorId: string,
    availability: RecurringAvailability | CustomAvailability,
    date: string,
  ) {
    const maxPatients = availability.maxCapacity!;
    const slotDuration = availability.slotDuration!;

    
    const existing = await this.waveRepo.findOne({
      where: { doctorId, date, startTime: availability.startTime },
    });
    if (existing) {
      throw new ConflictException(`Wave already exists for ${date} at ${availability.startTime}`);
    }

    const wave = this.waveRepo.create({
      doctorId,
      date,
      startTime: availability.startTime,
      endTime: availability.endTime,
      maxPatients,
      bookedCount: 0,
    });

    const saved = await this.waveRepo.save(wave);

    return {
      schedulingType: 'WAVE',
      date,
      wave: {
        id: saved.id,
        startTime: saved.startTime,
        endTime: saved.endTime,
        maxPatients: saved.maxPatients,
        slotDuration,
        bookedCount: 0,
        available: `${saved.maxPatients}/${saved.maxPatients}`,
      },
    };
  }



  async bookStreamSlot(patientId: string, streamSlotId: string, doctorId: string) {
    const slot = await this.streamSlotRepo.findOne({
      where: { id: streamSlotId, doctorId },
    });

    if (!slot) {
      throw new NotFoundException('Stream slot not found');
    }

    if (slot.isBooked) {
      throw new ConflictException('This slot is already booked');
    }

    
    const existingBooking = await this.bookingRepo.findOne({
      where: { patientId, doctorId, date: slot.date, bookingType: BookingType.STREAM },
    });
    if (existingBooking) {
      throw new ConflictException('You already have a booking with this doctor on this date');
    }

    slot.isBooked = true;
    slot.patientId = patientId;
    await this.streamSlotRepo.save(slot);

    const booking = this.bookingRepo.create({
      patientId,
      doctorId,
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
      message: 'Stream appointment booked successfully',
    };
  }


  async bookWaveSlot(patientId: string, waveId: string, doctorId: string) {
    const wave = await this.waveRepo.findOne({ where: { id: waveId, doctorId } });

    if (!wave) {
      throw new NotFoundException('Wave not found');
    }

   
    if (wave.bookedCount >= wave.maxPatients) {
      throw new ConflictException('Wave is full. No more bookings allowed.');
    }

    
    const existingBooking = await this.bookingRepo.findOne({
      where: { patientId, waveId, bookingType: BookingType.WAVE },
    });
    if (existingBooking) {
      throw new ConflictException('You have already booked this wave');
    }

 
    const tokenNumber = wave.bookedCount + 1;
    wave.bookedCount += 1;
    await this.waveRepo.save(wave);

    const booking = this.bookingRepo.create({
      patientId,
      doctorId,
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
      message: `Wave booked. Your token number is ${tokenNumber}`,
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
          isAvailable: !s.isBooked,
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
          timeWindow: `${w.startTime} – ${w.endTime}`,
          available: `${w.maxPatients - w.bookedCount}/${w.maxPatients}`,
          isFull: w.bookedCount >= w.maxPatients,
        })),
      };
    }

    return {
      doctorId,
      date,
      message: 'No slots or waves generated for this date',
    };
  }


  private validateTimeRange(startTime: string, endTime: string) {
    const start = this.timeToMinutes(startTime);
    const end = this.timeToMinutes(endTime);

    if (start >= end) {
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
    const newStartMin = this.timeToMinutes(newStart);
    const newEndMin = this.timeToMinutes(newEnd);

    for (const slot of existing) {
      const existingStart = this.timeToMinutes(slot.startTime);
      const existingEnd = this.timeToMinutes(slot.endTime);

      if (newStartMin < existingEnd && newEndMin > existingStart) {
        throw new ConflictException(
          `Availability ${newStart}-${newEnd} overlaps with existing slot ${slot.startTime}-${slot.endTime}`,
        );
      }
    }
  }

  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  private minutesToTime(minutes: number): string {
    const h = Math.floor(minutes / 60).toString().padStart(2, '0');
    const m = (minutes % 60).toString().padStart(2, '0');
    return `${h}:${m}`;
  }

  private getDayOfWeek(dateStr: string): DayOfWeek {
    const date = new Date(dateStr);
    const days: DayOfWeek[] = [
      DayOfWeek.SUNDAY,
      DayOfWeek.MONDAY,
      DayOfWeek.TUESDAY,
      DayOfWeek.WEDNESDAY,
      DayOfWeek.THURSDAY,
      DayOfWeek.FRIDAY,
      DayOfWeek.SATURDAY,
    ];
    return days[date.getDay()];
  }
}
