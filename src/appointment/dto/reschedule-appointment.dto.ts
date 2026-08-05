import { IsDateString, IsUUID } from 'class-validator';

export class RescheduleAppointmentDto {
  @IsDateString({}, { message: 'date must be in YYYY-MM-DD format' })
  date!: string;

  @IsUUID('4', { message: 'slotId must be a valid UUID' })
  slotId!: string;
}
