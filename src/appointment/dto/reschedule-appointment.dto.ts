import { IsDateString, IsOptional, IsString, IsUUID, Matches } from 'class-validator';

const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

export class RescheduleAppointmentDto {
  @IsDateString({}, { message: 'date must be in YYYY-MM-DD format' })
  date!: string;

  // STREAM: reschedule by slot ID (preferred — use the id returned by GET /patient/availability/:doctorId)
  @IsOptional()
  @IsUUID('4', { message: 'streamSlotId must be a valid UUID' })
  streamSlotId?: string;

  // STREAM: legacy — reschedule by time range (fallback if slot ID not provided)
  @IsOptional()
  @IsString()
  @Matches(TIME_REGEX, { message: 'startTime must be in HH:MM format' })
  startTime?: string;

  @IsOptional()
  @IsString()
  @Matches(TIME_REGEX, { message: 'endTime must be in HH:MM format' })
  endTime?: string;

  // WAVE: reschedule by wave ID
  @IsOptional()
  @IsUUID('4', { message: 'waveId must be a valid UUID' })
  waveId?: string;
}
