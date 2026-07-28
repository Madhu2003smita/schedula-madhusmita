import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum AppointmentStatus {
  BOOKED = 'BOOKED',
  CANCELLED = 'CANCELLED',
}

export enum AppointmentType {
  STREAM = 'STREAM',
  WAVE = 'WAVE',
}

@Entity('appointments')
export class Appointment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar' })
  patientId!: string;

  @Column({ type: 'varchar' })
  doctorId!: string;

  @Column({ type: 'date' })
  date!: string;

  @Column({ type: 'enum', enum: AppointmentType })
  appointmentType!: AppointmentType;

  @Column({ type: 'enum', enum: AppointmentStatus, default: AppointmentStatus.BOOKED })
  status!: AppointmentStatus;

  
  @Column({ type: 'varchar', nullable: true })
  streamSlotId!: string | null;

  @Column({ type: 'time', nullable: true })
  startTime!: string | null;

  @Column({ type: 'time', nullable: true })
  endTime!: string | null;

  
  @Column({ type: 'varchar', nullable: true })
  waveId!: string | null;

  @Column({ type: 'time', nullable: true })
  waveStartTime!: string | null;

  @Column({ type: 'time', nullable: true })
  waveEndTime!: string | null;

  @Column({ type: 'int', nullable: true })
  tokenNumber!: number | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
