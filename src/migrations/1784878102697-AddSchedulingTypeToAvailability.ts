import { MigrationInterface, QueryRunner } from "typeorm";

export class AddSchedulingTypeToAvailability1784878102697 implements MigrationInterface {
    name = 'AddSchedulingTypeToAvailability1784878102697'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."recurring_availability_schedulingtype_enum" AS ENUM('STREAM', 'WAVE')`);
        // Add with default to handle existing rows, then remove default
        await queryRunner.query(`ALTER TABLE "recurring_availability" ADD "schedulingType" "public"."recurring_availability_schedulingtype_enum" NOT NULL DEFAULT 'STREAM'`);
        await queryRunner.query(`ALTER TABLE "recurring_availability" ALTER COLUMN "schedulingType" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "recurring_availability" ADD "slotDuration" integer`);
        await queryRunner.query(`ALTER TABLE "recurring_availability" ADD "bufferTime" integer DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "recurring_availability" ADD "maxCapacity" integer`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "recurring_availability" DROP COLUMN "maxCapacity"`);
        await queryRunner.query(`ALTER TABLE "recurring_availability" DROP COLUMN "bufferTime"`);
        await queryRunner.query(`ALTER TABLE "recurring_availability" DROP COLUMN "slotDuration"`);
        await queryRunner.query(`ALTER TABLE "recurring_availability" DROP COLUMN "schedulingType"`);
        await queryRunner.query(`DROP TYPE "public"."recurring_availability_schedulingtype_enum"`);
    }

}
