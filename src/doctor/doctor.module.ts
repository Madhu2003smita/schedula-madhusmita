import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { DoctorController, PatientDoctorController } from './doctor.controller';
import { Doctor } from './doctor.entity';
import { DoctorService } from './doctor.service';

@Module({
  imports: [TypeOrmModule.forFeature([Doctor]), AuthModule],
  controllers: [DoctorController, PatientDoctorController],
  providers: [DoctorService],
})
export class DoctorModule {}
