import { IsDateString, IsUUID } from 'class-validator';

export class BookAppointmentDto {
  @IsUUID('4', { message: 'doctorId must be a valid UUID' })
  doctorId!: string;

  @IsDateString({}, { message: 'date must be in YYYY-MM-DD format' })
  date!: string;

  
  @IsUUID('4', { message: 'slotId must be a valid UUID' })
  slotId!: string;
}
