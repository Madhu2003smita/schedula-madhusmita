import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Min,
  ValidateIf,
} from 'class-validator';
import { SchedulingType } from '../entities/recurring-availability.entity';

const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

export class CreateCustomAvailabilityDto {
  @IsDateString({}, { message: 'date must be a valid date in YYYY-MM-DD format' })
  date!: string;

  @IsString()
  @Matches(TIME_REGEX, { message: 'startTime must be in HH:MM format' })
  startTime!: string;

  @IsString()
  @Matches(TIME_REGEX, { message: 'endTime must be in HH:MM format' })
  endTime!: string;

  @IsEnum(SchedulingType, {
    message: 'schedulingType must be either STREAM or WAVE',
  })
  schedulingType!: SchedulingType;

  
  @IsInt()
  @Min(1, { message: 'maxCapacity must be at least 1' })
  maxCapacity!: number;


  @IsOptional()
  @ValidateIf((o) => o.schedulingType === SchedulingType.WAVE)
  @IsInt()
  @Min(5, { message: 'slotDuration must be at least 5 minutes' })
  slotDuration?: number;
}
