import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Min,
  ValidateIf,
} from 'class-validator';
import {
  DayOfWeek,
  SchedulingType,
} from '../entities/recurring-availability.entity';

const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

export class CreateRecurringAvailabilityDto {
  @IsEnum(DayOfWeek, {
    message: 'dayOfWeek must be one of: MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY, SATURDAY, SUNDAY',
  })
  dayOfWeek!: DayOfWeek;

  @IsString()
  @Matches(TIME_REGEX, { message: 'startTime must be in HH:MM format (e.g. 10:00)' })
  startTime!: string;

  @IsString()
  @Matches(TIME_REGEX, { message: 'endTime must be in HH:MM format (e.g. 13:00)' })
  endTime!: string;

  @IsEnum(SchedulingType, {
    message: 'schedulingType must be either STREAM or WAVE',
  })
  schedulingType!: SchedulingType;

  
  @IsInt()
  @Min(5, { message: 'slotDuration must be at least 5 minutes' })
  slotDuration!: number;

  
  @IsInt()
  @Min(1, { message: 'maxCapacity must be at least 1' })
  maxCapacity!: number;

  
  @IsOptional()
  @ValidateIf((o) => o.schedulingType === SchedulingType.STREAM)
  @IsInt()
  @Min(0, { message: 'bufferTime cannot be negative' })
  bufferTime?: number;
}
