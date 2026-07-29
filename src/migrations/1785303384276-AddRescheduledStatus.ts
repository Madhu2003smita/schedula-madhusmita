import { MigrationInterface, QueryRunner } from "typeorm";

export class AddRescheduledStatus1785303384276 implements MigrationInterface {
    name = 'AddRescheduledStatus1785303384276'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TYPE "public"."appointments_status_enum" ADD VALUE 'RESCHEDULED'`
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `CREATE TYPE "public"."appointments_status_enum_old" AS ENUM('BOOKED', 'CANCELLED')`
        );
        await queryRunner.query(
            `ALTER TABLE "appointments" ALTER COLUMN "status" TYPE "public"."appointments_status_enum_old" USING "status"::text::"public"."appointments_status_enum_old"`
        );
        await queryRunner.query(
            `DROP TYPE "public"."appointments_status_enum"`
        );
        await queryRunner.query(
            `ALTER TYPE "public"."appointments_status_enum_old" RENAME TO "appointments_status_enum"`
        );
    }
}