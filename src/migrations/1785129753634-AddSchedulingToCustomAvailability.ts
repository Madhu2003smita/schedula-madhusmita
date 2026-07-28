import { MigrationInterface, QueryRunner } from "typeorm";

export class AddSchedulingToCustomAvailability1785129753634 implements MigrationInterface {
    name = 'AddSchedulingToCustomAvailability1785129753634'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "recurring_availability" DROP COLUMN IF EXISTS "bufferTime"`);
        await queryRunner.query(`CREATE TYPE "public"."custom_availability_schedulingtype_enum" AS ENUM('STREAM', 'WAVE')`);
        // Add with default first to handle existing rows, then remove default
        await queryRunner.query(`ALTER TABLE "custom_availability" ADD "schedulingType" "public"."custom_availability_schedulingtype_enum" NOT NULL DEFAULT 'STREAM'`);
        await queryRunner.query(`ALTER TABLE "custom_availability" ALTER COLUMN "schedulingType" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "custom_availability" ADD "slotDuration" integer`);
        await queryRunner.query(`ALTER TABLE "custom_availability" ADD "maxCapacity" integer`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "custom_availability" DROP COLUMN "maxCapacity"`);
        await queryRunner.query(`ALTER TABLE "custom_availability" DROP COLUMN "slotDuration"`);
        await queryRunner.query(`ALTER TABLE "custom_availability" DROP COLUMN "schedulingType"`);
        await queryRunner.query(`DROP TYPE "public"."custom_availability_schedulingtype_enum"`);
        await queryRunner.query(`ALTER TABLE "recurring_availability" ADD "bufferTime" integer DEFAULT '0'`);
    }

}
