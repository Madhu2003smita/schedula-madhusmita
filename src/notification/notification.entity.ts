import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum NotificationType {
  APPOINTMENT_BOOKED      = 'APPOINTMENT_BOOKED',
  APPOINTMENT_CANCELLED   = 'APPOINTMENT_CANCELLED',
  APPOINTMENT_RESCHEDULED = 'APPOINTMENT_RESCHEDULED',
}

@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar' })
  patientId!: string;

  @Column({ type: 'varchar' })
  appointmentId!: string;

  @Column({ type: 'enum', enum: NotificationType })
  type!: NotificationType;

  @Column({ type: 'varchar' })
  title!: string;

  @Column({ type: 'text' })
  message!: string;

  @Column({ type: 'boolean', default: false })
  isRead!: boolean;

  @CreateDateColumn()
  createdAt!: Date;
}
