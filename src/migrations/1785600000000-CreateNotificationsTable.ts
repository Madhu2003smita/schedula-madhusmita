import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateNotificationsTable1785600000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "notifications_type_enum" AS ENUM (
        'APPOINTMENT_BOOKED',
        'APPOINTMENT_CANCELLED',
        'APPOINTMENT_RESCHEDULED'
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "notifications" (
        "id"            uuid NOT NULL DEFAULT uuid_generate_v4(),
        "patientId"     character varying NOT NULL,
        "appointmentId" character varying NOT NULL,
        "type"          "notifications_type_enum" NOT NULL,
        "title"         character varying NOT NULL,
        "message"       text NOT NULL,
        "isRead"        boolean NOT NULL DEFAULT false,
        "createdAt"     TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_notifications" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_notifications_patientId" ON "notifications" ("patientId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_notifications_patientId"`);
    await queryRunner.query(`DROP TABLE "notifications"`);
    await queryRunner.query(`DROP TYPE "notifications_type_enum"`);
  }
}
