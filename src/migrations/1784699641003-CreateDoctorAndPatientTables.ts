import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateDoctorAndPatientTables1784699641003 implements MigrationInterface {
    name = 'CreateDoctorAndPatientTables1784699641003'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "doctors" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(),
             "userId" character varying NOT NULL, 
             "fullName" character varying NOT NULL,
              "specialization" character varying NOT NULL, 
              "experienceYears" integer NOT NULL,
               "qualification" character varying NOT NULL, 
               "consultationFee" numeric(10,2) NOT NULL,
                "availabilityHours" character varying NOT NULL,
                 "profileDetails" text, 
                 "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                  "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                   CONSTRAINT "UQ_55651e05e46413d510215535edf" UNIQUE ("userId"),
                    CONSTRAINT "PK_8207e7889b50ee3695c2b8154ff" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "patients" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(),
             "userId" character varying NOT NULL,
              "fullName" character varying NOT NULL, 
              "age" integer NOT NULL, 
              "gender" character varying NOT NULL,
               "contactNumber" character varying NOT NULL,
                "address" character varying,
                 "healthInfo" text,
                  "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                   "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), 
                   CONSTRAINT "UQ_2c24c3490a26d04b0d70f92057a" UNIQUE ("userId"), 
                   CONSTRAINT "PK_a7f0b9fcbb3469d5ec0b0aceaa7" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "patients"`);
        await queryRunner.query(`DROP TABLE "doctors"`);
    }

}
