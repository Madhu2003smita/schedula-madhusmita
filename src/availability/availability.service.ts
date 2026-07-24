import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateCustomAvailabilityDto } from './dto/create-custom-availability.dto';
import { CreateRecurringAvailabilityDto } from './dto/create-recurring-availability.dto';
import { UpdateRecurringAvailabilityDto } from './dto/update-recurring-availability.dto';
import { CustomAvailability } from './entities/custom-availability.entity';
import { DayOfWeek, RecurringAvailability } from './entities/recurring-availability.entity';

@Injectable()
export class AvailabilityService {
  constructor(
    @InjectRepository(RecurringAvailability)
    private readonly recurringRepo: Repository<RecurringAvailability>,
    @InjectRepository(CustomAvailability)
    private readonly customRepo: Repository<CustomAvailability>,
  ) {}

  

  async createRecurring(doctorId: string, dto: CreateRecurringAvailabilityDto) {
    
    this.validateTimeRange(dto.startTime, dto.endTime);

    
    const existing = await this.recurringRepo.find({
      where: { doctorId, dayOfWeek: dto.dayOfWeek },
    });

    this.checkOverlaps(existing, dto.startTime, dto.endTime);

    const availability = this.recurringRepo.create({ doctorId, ...dto });
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

  
    const existing = await this.customRepo.find({
      where: { doctorId, date: dto.date },
    });

    this.checkOverlaps(existing, dto.startTime, dto.endTime);

    const availability = this.customRepo.create({ doctorId, ...dto });
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
        availability: custom,
      };
    }

    
    const dayOfWeek = this.getDayOfWeek(date);
    const recurring = await this.recurringRepo.find({
      where: { doctorId, dayOfWeek },
      order: { startTime: 'ASC' },
    });

    return {
      date,
      type: 'recurring',
      dayOfWeek,
      availability: recurring,
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
          `Time slot ${newStart}-${newEnd} overlaps with existing slot ${slot.startTime}-${slot.endTime}`,
        );
      }
    }
  }

  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
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
