import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAuditLogsTable1785500000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "audit_logs_action_enum" AS ENUM (
        'APPOINTMENT_BOOKED',
        'APPOINTMENT_RESCHEDULED',
        'APPOINTMENT_CANCELLED',
        'APPOINTMENT_AUTO_MOVED',
        'AVAILABILITY_EXPANDED',
        'AVAILABILITY_SHRUNK'
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "audit_logs" (
        "id"          uuid NOT NULL DEFAULT uuid_generate_v4(),
        "action"      "audit_logs_action_enum" NOT NULL,
        "performedBy" character varying NOT NULL,
        "targetId"    character varying,
        "details"     text,
        "createdAt"   TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_audit_logs" PRIMARY KEY ("id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "audit_logs"`);
    await queryRunner.query(`DROP TYPE "audit_logs_action_enum"`);
  }
}
