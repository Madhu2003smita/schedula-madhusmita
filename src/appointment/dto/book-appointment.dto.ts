import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class BookAppointmentDto {
  @IsUUID('4', { message: 'doctorId must be a valid UUID' })
  doctorId!: string;

  @IsDateString({}, { message: 'date must be in YYYY-MM-DD format' })
  date!: string;

  /**
   * The slot or wave ID returned by GET /patient/availability/:doctorId?date=...
   * Works for both STREAM (stream slot id) and WAVE (wave id).
   * The service resolves which type it is automatically.
   */
  @IsOptional()
  @IsUUID('4', { message: 'slotId must be a valid UUID' })
  slotId?: string;
}
