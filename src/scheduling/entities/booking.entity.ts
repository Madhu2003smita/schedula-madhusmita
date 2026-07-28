import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum BookingType {
  STREAM = 'STREAM',
  WAVE = 'WAVE',
}

@Entity('bookings')
export class Booking {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar' })
  patientId!: string;

  @Column({ type: 'varchar' })
  doctorId!: string;

  @Column({ type: 'enum', enum: BookingType })
  bookingType!: BookingType;

  @Column({ type: 'date' })
  date!: string;

  @Column({ type: 'varchar', nullable: true })
  streamSlotId!: string | null;

  @Column({ type: 'time', nullable: true })
  slotStartTime!: string | null;

  @Column({ type: 'time', nullable: true })
  slotEndTime!: string | null;


  @Column({ type: 'varchar', nullable: true })
  waveId!: string | null;

  @Column({ type: 'time', nullable: true })
  waveStartTime!: string | null;

  @Column({ type: 'time', nullable: true })
  waveEndTime! : string | null;

  @Column({ type: 'int', nullable: true })
  tokenNumber!: number | null;

  @CreateDateColumn()
  createdAt!: Date;
}
