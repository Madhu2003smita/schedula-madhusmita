import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('waves')
export class Wave {
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

  @Column({ type: 'int' })
  maxPatients!: number;

  @Column({ type: 'int', default: 0 })
  bookedCount!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
