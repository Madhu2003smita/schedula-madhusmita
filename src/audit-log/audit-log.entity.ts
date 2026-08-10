import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export enum AuditAction {
  APPOINTMENT_BOOKED      = 'APPOINTMENT_BOOKED',
  APPOINTMENT_RESCHEDULED = 'APPOINTMENT_RESCHEDULED',
  APPOINTMENT_CANCELLED   = 'APPOINTMENT_CANCELLED',
  APPOINTMENT_AUTO_MOVED  = 'APPOINTMENT_AUTO_MOVED',
  AVAILABILITY_EXPANDED   = 'AVAILABILITY_EXPANDED',
  AVAILABILITY_SHRUNK     = 'AVAILABILITY_SHRUNK',
}

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'enum', enum: AuditAction })
  action!: AuditAction;

  
  @Column({ type: 'varchar' })
  performedBy!: string;

  
  @Column({ type: 'varchar', nullable: true })
  targetId!: string | null;

  
  @Column({ type: 'text', nullable: true })
  details!: string | null;

  @CreateDateColumn()
  createdAt!: Date;
}
