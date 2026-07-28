import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateAppointmentTable1785221897663 implements MigrationInterface {
    name = 'CreateAppointmentTable1785221897663'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."appointments_appointmenttype_enum" AS ENUM('STREAM', 'WAVE')`);
        await queryRunner.query(`CREATE TYPE "public"."appointments_status_enum" AS ENUM('BOOKED', 'CANCELLED')`);
        await queryRunner.query(`CREATE TABLE "appointments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "patientId" character varying NOT NULL, "doctorId" character varying NOT NULL, "date" date NOT NULL, "appointmentType" "public"."appointments_appointmenttype_enum" NOT NULL, "status" "public"."appointments_status_enum" NOT NULL DEFAULT 'BOOKED', "streamSlotId" character varying, "startTime" TIME, "endTime" TIME, "waveId" character varying, "waveStartTime" TIME, "waveEndTime" TIME, "tokenNumber" integer, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_4a437a9a27e948726b8bb3e36ad" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "appointments"`);
        await queryRunner.query(`DROP TYPE "public"."appointments_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."appointments_appointmenttype_enum"`);
    }

}
