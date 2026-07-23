import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('doctors')
export class Doctor {
  @PrimaryGeneratedColumn('uuid')
  id!: string; 

  @Column({ unique: true })
  userId!: string; 

  @Column()
  fullName!: string;

  @Column()
  specialization!: string;

  @Column({ type: 'int' })
  experienceYears!: number;

  @Column()
  qualification!: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  consultationFee!: number;

  @Column()
  availabilityHours!: string; 

  @Column({ type: 'text', nullable: true })
  profileDetails!: string | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
