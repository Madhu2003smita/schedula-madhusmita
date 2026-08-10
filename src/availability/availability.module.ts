import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { AuthModule } from '../auth/auth.module';
import { AppointmentModule } from '../appointment/appointment.module';
import { Booking } from '../scheduling/entities/booking.entity';
import { StreamSlot } from '../scheduling/entities/stream-slot.entity';
import { Wave } from '../scheduling/entities/wave.entity';
import { AvailabilityController, PatientAvailabilityController } from './availability.controller';
import { AvailabilityService } from './availability.service';
import { CustomAvailability } from './entities/custom-availability.entity';
import { RecurringAvailability } from './entities/recurring-availability.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([RecurringAvailability, CustomAvailability, StreamSlot, Wave, Booking]),
    AuthModule,
    AppointmentModule,
    AuditLogModule,
  ],
  controllers: [AvailabilityController, PatientAvailabilityController],
  providers: [AvailabilityService],
  exports: [AvailabilityService],
})
export class AvailabilityModule {}
