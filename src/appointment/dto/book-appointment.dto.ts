import { IsDateString, IsOptional, IsString, IsUUID, Matches } from 'class-validator';

const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

export class BookAppointmentDto {
  @IsUUID('4', { message: 'doctorId must be a valid UUID' })
  doctorId!: string;

  @IsDateString({}, { message: 'date must be in YYYY-MM-DD format' })
  date!: string;

  
  @IsOptional()
  @IsString()
  @Matches(TIME_REGEX, { message: 'startTime must be in HH:MM format' })
  startTime?: string;

  @IsOptional()
  @IsString()
  @Matches(TIME_REGEX, { message: 'endTime must be in HH:MM format' })
  endTime?: string;

  
  @IsOptional()
  @IsUUID('4', { message: 'waveId must be a valid UUID' })
  waveId?: string;
}
