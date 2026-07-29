import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('stream_slots')
export class StreamSlot {
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

  
  @Column({ type: 'int', default: 1 })
  maxCapacity!: number;


  @Column({ type: 'int', default: 0 })
  bookedCount!: number;

  
  @Column({ default: false })
  isBooked!: boolean;

  @Column({ type: 'varchar', nullable: true })
  patientId!: string | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
