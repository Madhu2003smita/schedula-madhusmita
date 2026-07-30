import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { SchedulingType } from './recurring-availability.entity';

@Entity('custom_availability')
export class CustomAvailability {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  doctorId!: string;

  @Column({ type: 'date' })
  date!: string;

  @Column({ type: 'time' })
  startTime!: string;

  @Column({ type: 'time' })
  endTime!: string;

  @Column({ type: 'enum', enum: SchedulingType })
  schedulingType!: SchedulingType;

  
  @Column({ type: 'int' })
  slotDuration!: number;

  
  @Column({ type: 'int' })
  maxCapacity!: number;

  
  @Column({ type: 'int', default: 0 })
  bufferTime!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
