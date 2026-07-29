import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateAvailabilitySchema1785302462575 implements MigrationInterface {
    name = 'UpdateAvailabilitySchema1785302462575'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "recurring_availability" ADD "bufferTime" integer NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "custom_availability" ADD "bufferTime" integer NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "stream_slots" ADD "maxCapacity" integer NOT NULL DEFAULT '1'`);
        await queryRunner.query(`ALTER TABLE "stream_slots" ADD "bookedCount" integer NOT NULL DEFAULT '0'`);
        // Set default for existing null rows before making NOT NULL
        await queryRunner.query(`UPDATE "recurring_availability" SET "slotDuration" = 15 WHERE "slotDuration" IS NULL`);
        await queryRunner.query(`UPDATE "recurring_availability" SET "maxCapacity" = 1 WHERE "maxCapacity" IS NULL`);
        await queryRunner.query(`UPDATE "custom_availability" SET "slotDuration" = 15 WHERE "slotDuration" IS NULL`);
        await queryRunner.query(`UPDATE "custom_availability" SET "maxCapacity" = 1 WHERE "maxCapacity" IS NULL`);
        await queryRunner.query(`ALTER TABLE "recurring_availability" ALTER COLUMN "slotDuration" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "recurring_availability" ALTER COLUMN "maxCapacity" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "custom_availability" ALTER COLUMN "slotDuration" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "custom_availability" ALTER COLUMN "maxCapacity" SET NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "custom_availability" ALTER COLUMN "maxCapacity" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "custom_availability" ALTER COLUMN "slotDuration" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "recurring_availability" ALTER COLUMN "maxCapacity" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "recurring_availability" ALTER COLUMN "slotDuration" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "stream_slots" DROP COLUMN "bookedCount"`);
        await queryRunner.query(`ALTER TABLE "stream_slots" DROP COLUMN "maxCapacity"`);
        await queryRunner.query(`ALTER TABLE "custom_availability" DROP COLUMN "bufferTime"`);
        await queryRunner.query(`ALTER TABLE "recurring_availability" DROP COLUMN "bufferTime"`);
    }

}
