import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AuditAction } from '../audit-log/audit-log.entity';
import { AuditLogService } from '../audit-log/audit-log.service';
import { StreamSlot } from '../scheduling/entities/stream-slot.entity';
import { Wave } from '../scheduling/entities/wave.entity';
import { BookAppointmentDto } from './dto/book-appointment.dto';
import { RescheduleAppointmentDto } from './dto/reschedule-appointment.dto';
import {
  Appointment,
  AppointmentStatus,
  AppointmentType,
} from './entities/appointment.entity';

@Injectable()
export class AppointmentService {
  constructor(
    @InjectRepository(Appointment)
    private readonly appointmentRepo: Repository<Appointment>,
    @InjectRepository(StreamSlot)
    private readonly streamSlotRepo: Repository<StreamSlot>,
    @InjectRepository(Wave)
    private readonly waveRepo: Repository<Wave>,
    private readonly dataSource: DataSource,
    private readonly auditLogService: AuditLogService,
  ) {}



  async bookAppointment(patientId: string, dto: BookAppointmentDto) {
    if (!dto.date) {
      throw new BadRequestException(
        'date is required in the request body (format: YYYY-MM-DD)',
      );
    }

    if (!dto.doctorId) {
      throw new BadRequestException('doctorId is required in the request body');
    }

    if (!dto.slotId) {
      throw new BadRequestException(
        'slotId is required. Use the id returned by GET /patient/availability/:doctorId?date=...',
      );
    }

    this.validateFutureDate(dto.date);

    const streamSlot = await this.streamSlotRepo.findOne({
      where: { id: dto.slotId, doctorId: dto.doctorId, date: dto.date },
    });

    if (streamSlot) {
      return this.bookStream(patientId, dto.doctorId, dto.date, streamSlot);
    }

    const wave = await this.waveRepo.findOne({
      where: { id: dto.slotId, doctorId: dto.doctorId, date: dto.date },
    });

    if (wave) {
      return this.bookWave(patientId, dto.doctorId, dto.date, wave);
    }

    throw new NotFoundException(
      `No slot found with id ${dto.slotId} for this doctor on ${dto.date}`,
    );
  }

  private async bookStream(
    patientId: string,
    doctorId: string,
    date: string,
    slot: StreamSlot,
  ) {
    return this.dataSource.transaction(async (manager) => {
      // Pessimistic lock — prevents two patients grabbing the last seat simultaneously
      const lockedSlot = await manager.findOne(StreamSlot, {
        where: { id: slot.id },
        lock: { mode: 'pessimistic_write' },
      });

      if (!lockedSlot) throw new NotFoundException('Slot no longer exists');

      if (lockedSlot.bookedCount >= lockedSlot.maxCapacity) {
        throw new ConflictException('This slot is fully booked');
      }

      const existing = await manager.findOne(Appointment, {
        where: {
          patientId,
          doctorId,
          date,
          appointmentType: AppointmentType.STREAM,
          status: AppointmentStatus.BOOKED,
        },
      });
      if (existing) {
        throw new ConflictException(
          'You already have a booked appointment with this doctor on this date',
        );
      }

      lockedSlot.bookedCount += 1;
      lockedSlot.isBooked = lockedSlot.bookedCount >= lockedSlot.maxCapacity;
      lockedSlot.patientId = patientId;
      await manager.save(lockedSlot);

      const appointment = manager.create(Appointment, {
        patientId,
        doctorId,
        date,
        appointmentType: AppointmentType.STREAM,
        status: AppointmentStatus.BOOKED,
        streamSlotId: lockedSlot.id,
        startTime: lockedSlot.startTime,
        endTime: lockedSlot.endTime,
      });

      const saved = await manager.save(appointment);

      await this.auditLogService.log(
        AuditAction.APPOINTMENT_BOOKED, patientId, saved.id,
        `STREAM booked with doctor ${doctorId} on ${date} at ${lockedSlot.startTime}–${lockedSlot.endTime}`,
      );

      return {
        appointmentId: saved.id,
        type: 'STREAM',
        status: 'BOOKED',
        doctorId,
        date,
        appointmentTime: `${lockedSlot.startTime} – ${lockedSlot.endTime}`,
        message: 'Appointment booked successfully',
      };
    });
  }

  private async bookWave(
    patientId: string,
    doctorId: string,
    date: string,
    wave: Wave,
  ) {
    return this.dataSource.transaction(async (manager) => {
      
      const lockedWave = await manager.findOne(Wave, {
        where: { id: wave.id },
        lock: { mode: 'pessimistic_write' },
      });

      if (!lockedWave) throw new NotFoundException('Wave no longer exists');

      if (lockedWave.bookedCount >= lockedWave.maxPatients) {
        throw new ConflictException('This wave is full. No more bookings allowed.');
      }

      const existing = await manager.findOne(Appointment, {
        where: { patientId, waveId: lockedWave.id, status: AppointmentStatus.BOOKED },
      });
      if (existing) {
        throw new ConflictException('You have already booked this wave');
      }

    
      const tokenNumber = lockedWave.bookedCount + 1;
      lockedWave.bookedCount += 1;
      await manager.save(lockedWave);

      const appointment = manager.create(Appointment, {
        patientId,
        doctorId,
        date,
        appointmentType: AppointmentType.WAVE,
        status: AppointmentStatus.BOOKED,
        waveId: lockedWave.id,
        waveStartTime: lockedWave.startTime,
        waveEndTime: lockedWave.endTime,
        tokenNumber,
      });

      const saved = await manager.save(appointment);

      await this.auditLogService.log(
        AuditAction.APPOINTMENT_BOOKED, patientId, saved.id,
        `WAVE booked with doctor ${doctorId} on ${date} at ${lockedWave.startTime}–${lockedWave.endTime}, token #${tokenNumber}`,
      );

      return {
        appointmentId: saved.id,
        type: 'WAVE',
        status: 'BOOKED',
        doctorId,
        date,
        timeWindow: `${lockedWave.startTime} – ${lockedWave.endTime}`,
        tokenNumber,
        message: `Appointment booked. Your token number is ${tokenNumber}`,
      };
    });
  }

  

  async getMyAppointments(patientId: string) {
    const appointments = await this.appointmentRepo.find({
      where: { patientId },
      order: { date: 'ASC', createdAt: 'DESC' },
    });

    if (appointments.length === 0) {
      return { message: 'No appointments found', appointments: [] };
    }

    return {
      total: appointments.length,
      appointments: appointments.map((a) => this.formatAppointment(a)),
    };
  }

  async getDoctorAppointments(doctorId: string) {
    const appointments = await this.appointmentRepo.find({
      where: { doctorId },
      order: { date: 'ASC', createdAt: 'DESC' },
    });

    if (appointments.length === 0) {
      return { message: 'No appointments found', appointments: [] };
    }

    return {
      total: appointments.length,
      appointments: appointments.map((a) => this.formatAppointment(a)),
    };
  }

  

  async cancelAppointment(patientId: string, appointmentId: string) {
    const appointment = await this.appointmentRepo.findOne({
      where: { id: appointmentId },
    });

    if (!appointment) throw new NotFoundException('Appointment not found');

    if (appointment.patientId !== patientId) {
      throw new ForbiddenException('You can only cancel your own appointments');
    }

    if (appointment.status === AppointmentStatus.CANCELLED) {
      throw new ConflictException('Appointment is already cancelled');
    }

    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (new Date(appointment.date) < today) {
      throw new BadRequestException('Cannot cancel past appointments');
    }

    
    this.enforce30MinCutoff(appointment.date, appointment.startTime ?? appointment.waveStartTime, 'cancel');

    
    if (appointment.appointmentType === AppointmentType.STREAM && appointment.streamSlotId) {
      const slot = await this.streamSlotRepo.findOne({
        where: { id: appointment.streamSlotId },
      });
      if (slot) {
        slot.bookedCount = Math.max(0, slot.bookedCount - 1);
        slot.isBooked = slot.bookedCount >= slot.maxCapacity;
        slot.patientId = null;
        await this.streamSlotRepo.save(slot);
      }
    }

    if (appointment.appointmentType === AppointmentType.WAVE && appointment.waveId) {
      const wave = await this.waveRepo.findOne({ where: { id: appointment.waveId } });
      if (wave && wave.bookedCount > 0) {
        wave.bookedCount -= 1;
        await this.waveRepo.save(wave);
      }
    }

    appointment.status = AppointmentStatus.CANCELLED;
    await this.appointmentRepo.save(appointment);

    await this.auditLogService.log(
      AuditAction.APPOINTMENT_CANCELLED, patientId, appointment.id,
      `Cancelled. Was on ${appointment.date} at ${appointment.startTime ?? appointment.waveStartTime}`,
    );

    return {
      appointmentId: appointment.id,
      status: 'CANCELLED',
      message: 'Appointment cancelled successfully',
    };
  }

  

  async rescheduleAppointment(
    patientId: string,
    appointmentId: string,
    dto: RescheduleAppointmentDto,
  ) {
    // 1. Appointment must exist
    const appointment = await this.appointmentRepo.findOne({
      where: { id: appointmentId },
    });
    if (!appointment) throw new NotFoundException('Appointment not found');

    // 2. Ownership check
    if (appointment.patientId !== patientId) {
      throw new ForbiddenException('You can only reschedule your own appointments');
    }

    // 3. Cannot reschedule a cancelled appointment
    if (appointment.status === AppointmentStatus.CANCELLED) {
      throw new BadRequestException('Cannot reschedule a cancelled appointment');
    }

    // 4. Cannot reschedule past appointments
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (new Date(appointment.date) < today) {
      throw new BadRequestException('Cannot reschedule past appointments');
    }

    // 5. 30-minute cutoff on the current appointment
    this.enforce30MinCutoff(
      appointment.date,
      appointment.startTime ?? appointment.waveStartTime,
      'reschedule',
    );

    // 6. New date must be today or in the future
    this.validateFutureDate(dto.date);

    // 7. slotId is required
    if (!dto.slotId) {
      throw new BadRequestException(
        'slotId is required. Use the id returned by GET /patient/availability/:doctorId?date=...',
      );
    }

    // 8. Dispatch by type
    if (appointment.appointmentType === AppointmentType.STREAM) {
      return this.rescheduleStream(patientId, appointment, dto);
    } else if (appointment.appointmentType === AppointmentType.WAVE) {
      return this.rescheduleWave(appointment, dto);
    } else {
      throw new BadRequestException('Invalid scheduling type on this appointment');
    }
  }

  private async rescheduleStream(
    patientId: string,
    appointment: Appointment,
    dto: RescheduleAppointmentDto,
  ) {
    // Look up the requested new slot (outside transaction for early validation)
    const newSlot = await this.streamSlotRepo.findOne({
      where: { id: dto.slotId, doctorId: appointment.doctorId, date: dto.date },
    });

    if (!newSlot) {
      const suggestion = await this.findNextAvailableStream(appointment.doctorId, dto.date);
      throw new NotFoundException({
        message: `No stream slot found with id ${dto.slotId} for doctor on ${dto.date}`,
        suggestion,
      });
    }

    const isSameSlot =
      appointment.streamSlotId === newSlot.id ||
      (appointment.date === dto.date && appointment.startTime === newSlot.startTime);
    if (isSameSlot) {
      throw new BadRequestException('Cannot reschedule to the same slot and time');
    }

    this.enforce30MinCutoff(dto.date, newSlot.startTime, 'reschedule to');

    return this.dataSource.transaction(async (manager) => {
      // Lock the new slot to prevent race condition
      const lockedSlot = await manager.findOne(StreamSlot, {
        where: { id: newSlot.id },
        lock: { mode: 'pessimistic_write' },
      });

      if (!lockedSlot) throw new NotFoundException('Slot no longer exists');

      if (lockedSlot.bookedCount >= lockedSlot.maxCapacity) {
        const suggestion = await this.findNextAvailableStream(
          appointment.doctorId, dto.date, newSlot.id,
        );
        throw new ConflictException({ message: 'The requested slot is fully booked', suggestion });
      }

      // Release old slot
      if (appointment.streamSlotId) {
        const oldSlot = await manager.findOne(StreamSlot, {
          where: { id: appointment.streamSlotId },
          lock: { mode: 'pessimistic_write' },
        });
        if (oldSlot) {
          oldSlot.bookedCount = Math.max(0, oldSlot.bookedCount - 1);
          oldSlot.isBooked = oldSlot.bookedCount >= oldSlot.maxCapacity;
          oldSlot.patientId = null;
          await manager.save(oldSlot);
        }
      }

      // Reserve new slot
      lockedSlot.bookedCount += 1;
      lockedSlot.isBooked = lockedSlot.bookedCount >= lockedSlot.maxCapacity;
      lockedSlot.patientId = patientId;
      await manager.save(lockedSlot);

      appointment.date = dto.date;
      appointment.streamSlotId = lockedSlot.id;
      appointment.startTime = lockedSlot.startTime;
      appointment.endTime = lockedSlot.endTime;
      appointment.status = AppointmentStatus.RESCHEDULED;
      await manager.save(appointment);

      await this.auditLogService.log(
        AuditAction.APPOINTMENT_RESCHEDULED, patientId, appointment.id,
        `STREAM rescheduled to ${dto.date} at ${lockedSlot.startTime}–${lockedSlot.endTime}`,
      );

      return {
        appointmentId: appointment.id,
        type: 'STREAM',
        status: 'RESCHEDULED',
        date: dto.date,
        appointmentTime: `${lockedSlot.startTime} – ${lockedSlot.endTime}`,
        message: 'Appointment rescheduled successfully',
      };
    });
  }

  private async rescheduleWave(
    appointment: Appointment,
    dto: RescheduleAppointmentDto,
  ) {
    const newWave = await this.waveRepo.findOne({
      where: { id: dto.slotId, doctorId: appointment.doctorId, date: dto.date },
    });

    if (!newWave) {
      const suggestion = await this.findNextAvailableWave(appointment.doctorId, dto.date);
      throw new NotFoundException({
        message: `No wave found with id ${dto.slotId} for doctor on ${dto.date}`,
        suggestion,
      });
    }

    const isSameWave =
      appointment.waveId === newWave.id ||
      (appointment.date === dto.date && appointment.waveStartTime === newWave.startTime);
    if (isSameWave) {
      throw new BadRequestException('Cannot reschedule to the same wave and time');
    }

    this.enforce30MinCutoff(dto.date, newWave.startTime, 'reschedule to');

    return this.dataSource.transaction(async (manager) => {
      // Lock the new wave — guarantees unique token numbers under concurrency
      const lockedWave = await manager.findOne(Wave, {
        where: { id: newWave.id },
        lock: { mode: 'pessimistic_write' },
      });

      if (!lockedWave) throw new NotFoundException('Wave no longer exists');

      if (lockedWave.bookedCount >= lockedWave.maxPatients) {
        const suggestion = await this.findNextAvailableWave(
          appointment.doctorId, dto.date, newWave.id,
        );
        throw new ConflictException({ message: 'The requested wave is full', suggestion });
      }

      // Release old wave
      if (appointment.waveId) {
        const oldWave = await manager.findOne(Wave, {
          where: { id: appointment.waveId },
          lock: { mode: 'pessimistic_write' },
        });
        if (oldWave && oldWave.bookedCount > 0) {
          oldWave.bookedCount -= 1;
          await manager.save(oldWave);
        }
      }

      // Token is safe because we hold the lock on the wave row
      const tokenNumber = lockedWave.bookedCount + 1;
      lockedWave.bookedCount += 1;
      await manager.save(lockedWave);

      appointment.date = dto.date;
      appointment.waveId = lockedWave.id;
      appointment.waveStartTime = lockedWave.startTime;
      appointment.waveEndTime = lockedWave.endTime;
      appointment.tokenNumber = tokenNumber;
      appointment.status = AppointmentStatus.RESCHEDULED;
      await manager.save(appointment);

      await this.auditLogService.log(
        AuditAction.APPOINTMENT_RESCHEDULED, appointment.patientId, appointment.id,
        `WAVE rescheduled to ${dto.date} at ${lockedWave.startTime}–${lockedWave.endTime}, token #${tokenNumber}`,
      );

      return {
        appointmentId: appointment.id,
        type: 'WAVE',
        status: 'RESCHEDULED',
        date: dto.date,
        timeWindow: `${lockedWave.startTime} – ${lockedWave.endTime}`,
        tokenNumber,
        message: 'Appointment rescheduled successfully',
      };
    });
  }

  // ─── Suggest Next Available ──────────────────────────────────────────────────

 
  private async findNextAvailableStream(
    doctorId: string,
    fromDate: string,
    excludeSlotId?: string,
  ): Promise<object | null> {
    const now = new Date();
    const cutoff = new Date(now.getTime() + 30 * 60 * 1000);

    // Search same day first, then up to 6 more days
    for (let i = 0; i < 7; i++) {
      const d = new Date(fromDate);
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];

      const slots = await this.streamSlotRepo.find({
        where: { doctorId, date: dateStr },
        order: { startTime: 'ASC' },
      });

      for (const slot of slots) {
        if (excludeSlotId && slot.id === excludeSlotId) continue;
        if (slot.bookedCount >= slot.maxCapacity) continue;

        // Must be at least 30 min in the future
        const slotStart = new Date(`${dateStr}T${slot.startTime}`);
        if (slotStart <= cutoff) continue;

        return {
          slotId: slot.id,
          date: dateStr,
          startTime: slot.startTime,
          endTime: slot.endTime,
          remainingCapacity: slot.maxCapacity - slot.bookedCount,
        };
      }
    }

    return null;
  }

  
  private async findNextAvailableWave(
    doctorId: string,
    fromDate: string,
    excludeWaveId?: string,
  ): Promise<object | null> {
    const now = new Date();
    const cutoff = new Date(now.getTime() + 30 * 60 * 1000);

    for (let i = 0; i < 7; i++) {
      const d = new Date(fromDate);
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];

      const waves = await this.waveRepo.find({
        where: { doctorId, date: dateStr },
        order: { startTime: 'ASC' },
      });

      for (const wave of waves) {
        if (excludeWaveId && wave.id === excludeWaveId) continue;
        if (wave.bookedCount >= wave.maxPatients) continue;

        const waveStart = new Date(`${dateStr}T${wave.startTime}`);
        if (waveStart <= cutoff) continue;

        return {
          waveId: wave.id,
          date: dateStr,
          startTime: wave.startTime,
          endTime: wave.endTime,
          remainingCapacity: wave.maxPatients - wave.bookedCount,
        };
      }
    }

    return null;
  }

  
  async findAppointmentsBySlotId(streamSlotId: string): Promise<Appointment[]> {
    return this.appointmentRepo.find({
      where: {
        streamSlotId,
        status: AppointmentStatus.BOOKED,
        appointmentType: AppointmentType.STREAM,
      },
    });
  }

  
  async findAppointmentsByWaveId(waveId: string): Promise<Appointment[]> {
    return this.appointmentRepo.find({
      where: {
        waveId,
        status: AppointmentStatus.BOOKED,
        appointmentType: AppointmentType.WAVE,
      },
    });
  }


  async moveAppointmentToSlot(appointmentId: string, newSlot: StreamSlot): Promise<void> {
    const appt = await this.appointmentRepo.findOne({ where: { id: appointmentId } });
    if (!appt) return;

    // Release old slot
    if (appt.streamSlotId) {
      const oldSlot = await this.streamSlotRepo.findOne({ where: { id: appt.streamSlotId } });
      if (oldSlot) {
        oldSlot.bookedCount = Math.max(0, oldSlot.bookedCount - 1);
        oldSlot.isBooked = oldSlot.bookedCount >= oldSlot.maxCapacity;
        oldSlot.patientId = null;
        await this.streamSlotRepo.save(oldSlot);
      }
    }

    // Reserve new slot
    newSlot.bookedCount += 1;
    newSlot.isBooked = newSlot.bookedCount >= newSlot.maxCapacity;
    newSlot.patientId = appt.patientId;
    await this.streamSlotRepo.save(newSlot);

    // Update appointment
    appt.streamSlotId = newSlot.id;
    appt.startTime = newSlot.startTime;
    appt.endTime = newSlot.endTime;
    appt.status = AppointmentStatus.RESCHEDULED;
    await this.appointmentRepo.save(appt);

    await this.auditLogService.log(
      AuditAction.APPOINTMENT_AUTO_MOVED, appt.patientId, appt.id,
      `STREAM auto-moved to ${newSlot.startTime}–${newSlot.endTime} on ${newSlot.date} due to availability shrink`,
    );
  }

 
  async moveAppointmentToWave(appointmentId: string, newWave: Wave): Promise<void> {
    const appt = await this.appointmentRepo.findOne({ where: { id: appointmentId } });
    if (!appt) return;

    // Release old wave
    if (appt.waveId) {
      const oldWave = await this.waveRepo.findOne({ where: { id: appt.waveId } });
      if (oldWave && oldWave.bookedCount > 0) {
        oldWave.bookedCount -= 1;
        await this.waveRepo.save(oldWave);
      }
    }

    // Reserve new wave and assign token
    const tokenNumber = newWave.bookedCount + 1;
    newWave.bookedCount += 1;
    await this.waveRepo.save(newWave);

    // Update appointment
    appt.waveId = newWave.id;
    appt.waveStartTime = newWave.startTime;
    appt.waveEndTime = newWave.endTime;
    appt.tokenNumber = tokenNumber;
    appt.status = AppointmentStatus.RESCHEDULED;
    await this.appointmentRepo.save(appt);

    await this.auditLogService.log(
      AuditAction.APPOINTMENT_AUTO_MOVED, appt.patientId, appt.id,
      `WAVE auto-moved to ${newWave.startTime}–${newWave.endTime} on ${newWave.date}, token #${tokenNumber} due to availability shrink`,
    );
  }
  
  private enforce30MinCutoff(
    date: string,
    startTime: string | null | undefined,
    action: string,
  ) {
    if (!startTime) return;

    // Treat the stored time as UTC (server timezone on Railway)
    const timeStr = startTime.substring(0, 5); // normalize to HH:MM
    const appointmentStart = new Date(`${date}T${timeStr}:00.000Z`);
    const now = new Date();
    const cutoff = new Date(now.getTime() + 30 * 60 * 1000);

    if (appointmentStart <= cutoff) {
      throw new BadRequestException(
        `Cannot ${action} an appointment that starts within 30 minutes`,
      );
    }
  }

  private validateFutureDate(date: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (new Date(date) < today) {
      throw new BadRequestException('Cannot book appointments for past dates');
    }
  }

  private formatAppointment(a: Appointment) {
    if (a.appointmentType === AppointmentType.STREAM) {
      return {
        appointmentId: a.id,
        type: 'STREAM',
        status: a.status,
        doctorId: a.doctorId,
        patientId: a.patientId,
        date: a.date,
        appointmentTime: `${a.startTime} – ${a.endTime}`,
        createdAt: a.createdAt,
      };
    } else {
      return {
        appointmentId: a.id,
        type: 'WAVE',
        status: a.status,
        doctorId: a.doctorId,
        patientId: a.patientId,
        date: a.date,
        timeWindow: `${a.waveStartTime} – ${a.waveEndTime}`,
        tokenNumber: a.tokenNumber,
        createdAt: a.createdAt,
      };
    }
  }
}
