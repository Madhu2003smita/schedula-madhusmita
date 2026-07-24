import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateSchedulingTables1784874079387 implements MigrationInterface {
    name = 'CreateSchedulingTables1784874079387'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."schedule_configs_schedulingtype_enum" AS ENUM('STREAM', 'WAVE')`);
        await queryRunner.query(`CREATE TABLE "schedule_configs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "doctorId" character varying NOT NULL, "schedulingType" "public"."schedule_configs_schedulingtype_enum" NOT NULL, "slotDurationMinutes" integer, "bufferTimeMinutes" integer DEFAULT '0', "maxPatientsPerWave" integer, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_fc5a96ff35f50d10d4f06913174" UNIQUE ("doctorId"), CONSTRAINT "PK_039456f93480fdbae4be3921f9a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "stream_slots" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "doctorId" character varying NOT NULL, "date" date NOT NULL, "startTime" TIME NOT NULL, "endTime" TIME NOT NULL, "isBooked" boolean NOT NULL DEFAULT false, "patientId" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_66b5415aed1a89243d6efa0e9f8" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "waves" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "doctorId" character varying NOT NULL, "date" date NOT NULL, "startTime" TIME NOT NULL, "endTime" TIME NOT NULL, "maxPatients" integer NOT NULL, "bookedCount" integer NOT NULL DEFAULT '0', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_b9a2d49cb544011314ff8ce0fd6" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."bookings_bookingtype_enum" AS ENUM('STREAM', 'WAVE')`);
        await queryRunner.query(`CREATE TABLE "bookings" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "patientId" character varying NOT NULL, "doctorId" character varying NOT NULL, "bookingType" "public"."bookings_bookingtype_enum" NOT NULL, "date" date NOT NULL, "streamSlotId" character varying, "slotStartTime" TIME, "slotEndTime" TIME, "waveId" character varying, "waveStartTime" TIME, "waveEndTime" TIME, "tokenNumber" integer, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_bee6805982cc1e248e94ce94957" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "bookings"`);
        await queryRunner.query(`DROP TYPE "public"."bookings_bookingtype_enum"`);
        await queryRunner.query(`DROP TABLE "waves"`);
        await queryRunner.query(`DROP TABLE "stream_slots"`);
        await queryRunner.query(`DROP TABLE "schedule_configs"`);
        await queryRunner.query(`DROP TYPE "public"."schedule_configs_schedulingtype_enum"`);
    }

}
