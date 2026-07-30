import { MigrationInterface, QueryRunner } from 'typeorm';

export class RefactorAvailabilityStreamNoSlotDuration1785400000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    
    await queryRunner.query(`
      ALTER TABLE "recurring_availability"
        ALTER COLUMN "slotDuration" DROP NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "custom_availability"
        ALTER COLUMN "slotDuration" DROP NOT NULL
    `);

  
    await queryRunner.query(`
      ALTER TABLE "recurring_availability"
        DROP COLUMN IF EXISTS "bufferTime"
    `);

    await queryRunner.query(`
      ALTER TABLE "custom_availability"
        DROP COLUMN IF EXISTS "bufferTime"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Restore bufferTime with default 0
    await queryRunner.query(`
      ALTER TABLE "recurring_availability"
        ADD COLUMN "bufferTime" INT NOT NULL DEFAULT 0
    `);

    await queryRunner.query(`
      ALTER TABLE "custom_availability"
        ADD COLUMN "bufferTime" INT NOT NULL DEFAULT 0
    `);

    
    await queryRunner.query(`
      UPDATE "recurring_availability" SET "slotDuration" = 0 WHERE "slotDuration" IS NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "recurring_availability"
        ALTER COLUMN "slotDuration" SET NOT NULL
    `);

    await queryRunner.query(`
      UPDATE "custom_availability" SET "slotDuration" = 0 WHERE "slotDuration" IS NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "custom_availability"
        ALTER COLUMN "slotDuration" SET NOT NULL
    `);
  }
}
