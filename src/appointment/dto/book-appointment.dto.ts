import { IsDateString, IsString, IsUUID, Matches } from 'class-validator';

export class BookAppointmentDto {
  @IsUUID('4', { message: 'doctorId must be a valid UUID' })
  doctorId!: string;

  @IsDateString({}, { message: 'date must be in YYYY-MM-DD format' })
  date!: string;

  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'time must be in HH:MM format (e.g. 10:00)' })
  time!: string;
}
