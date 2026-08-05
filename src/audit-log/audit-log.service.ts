import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { AuditAction, AuditLog } from './audit-log.entity';

@Injectable()
export class AuditLogService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
  ) {}

 
  async log(
    action: AuditAction,
    performedBy: string,
    targetId: string | null,
    details: string,
  ): Promise<void> {
    const entry = this.auditRepo.create({ action, performedBy, targetId, details });
    await this.auditRepo.save(entry).catch(() => {});
  }

  
  async logWithManager(
    manager: EntityManager,
    action: AuditAction,
    performedBy: string,
    targetId: string | null,
    details: string,
  ): Promise<void> {
    const entry = manager.create(AuditLog, { action, performedBy, targetId, details });
    await manager.save(entry).catch(() => {});
  }
}
