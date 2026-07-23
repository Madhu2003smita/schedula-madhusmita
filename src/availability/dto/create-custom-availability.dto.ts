import { IsDateString, IsString, Matches } from 'class-validator';

const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

export class CreateCustomAvailabilityDto {
  @IsDateString({}, { message: 'date must be a valid date in YYYY-MM-DD format' })
  date!: string; 

  @IsString()
  @Matches(TIME_REGEX, { message: 'startTime must be in HH:MM format (e.g. 14:00)' })
  startTime!: string;

  @IsString()
  @Matches(TIME_REGEX, { message: 'endTime must be in HH:MM format (e.g. 15:00)' })
  endTime!: string;
}
