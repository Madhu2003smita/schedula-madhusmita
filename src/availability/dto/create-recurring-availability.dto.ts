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
  @Matches(TIME_REGEX, { message: 'startTime must be in HH:MM format (e.g. 09:00)' })
  startTime!: string;

  @IsString()
  @Matches(TIME_REGEX, { message: 'endTime must be in HH:MM format (e.g. 12:00)' })
  endTime!: string;

  @IsEnum(SchedulingType, {
    message: 'schedulingType must be either STREAM or WAVE',
  })
  schedulingType!: SchedulingType;

  // STREAM: total patients for the whole session window (no slot subdivision)
  // WAVE: patients per wave window (each window = slotDuration mins)
  @IsInt()
  @Min(1, { message: 'maxCapacity must be at least 1' })
  maxCapacity!: number;

  // WAVE only: length of each wave window in minutes
  @IsOptional()
  @ValidateIf((o) => o.schedulingType === SchedulingType.WAVE)
  @IsInt()
  @Min(5, { message: 'slotDuration must be at least 5 minutes' })
  slotDuration?: number;
}
