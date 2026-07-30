import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
    if (slot.bookedCount >= slot.maxCapacity) {
      throw new ConflictException('This slot is fully booked');
    }

    const existing = await this.appointmentRepo.findOne({
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

    slot.bookedCount += 1;
    slot.isBooked = slot.bookedCount >= slot.maxCapacity;
    slot.patientId = patientId;
    await this.streamSlotRepo.save(slot);

    const appointment = this.appointmentRepo.create({
      patientId,
      doctorId,
      date,
      appointmentType: AppointmentType.STREAM,
      status: AppointmentStatus.BOOKED,
      streamSlotId: slot.id,
      startTime: slot.startTime,
      endTime: slot.endTime,
    });

    const saved = await this.appointmentRepo.save(appointment);

    return {
      appointmentId: saved.id,
      type: 'STREAM',
      status: 'BOOKED',
      doctorId,
      date,
      appointmentTime: `${slot.startTime} – ${slot.endTime}`,
      message: 'Appointment booked successfully',
    };
  }

  private async bookWave(
    patientId: string,
    doctorId: string,
    date: string,
    wave: Wave,
  ) {
    if (wave.bookedCount >= wave.maxPatients) {
      throw new ConflictException('This wave is full. No more bookings allowed.');
    }

    const existing = await this.appointmentRepo.findOne({
      where: { patientId, waveId: wave.id, status: AppointmentStatus.BOOKED },
    });
    if (existing) {
      throw new ConflictException('You have already booked this wave');
    }

    const tokenNumber = wave.bookedCount + 1;
    wave.bookedCount += 1;
    await this.waveRepo.save(wave);

    const appointment = this.appointmentRepo.create({
      patientId,
      doctorId,
      date,
      appointmentType: AppointmentType.WAVE,
      status: AppointmentStatus.BOOKED,
      waveId: wave.id,
      waveStartTime: wave.startTime,
      waveEndTime: wave.endTime,
      tokenNumber,
    });

    const saved = await this.appointmentRepo.save(appointment);

    return {
      appointmentId: saved.id,
      type: 'WAVE',
      status: 'BOOKED',
      doctorId,
      date,
      timeWindow: `${wave.startTime} – ${wave.endTime}`,
      tokenNumber,
      message: `Appointment booked. Your token number is ${tokenNumber}`,
    };
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

    // Restore slot/wave capacity
    if (appointment.appointmentType === AppointmentType.STREAM && appointment.streamSlotId) {
      const slot = await this.streamSlotRepo.findOne({ where: { id: appointment.streamSlotId } });
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

    return {
      appointmentId: appointment.id,
      status: 'CANCELLED',
      message: 'Appointment cancelled successfully',
    };
  }

  // ─── Reschedule ──────────────────────────────────────────────────────────────

  async rescheduleAppointment(
    patientId: string,
    appointmentId: string,
    dto: RescheduleAppointmentDto,
  ) {
    const appointment = await this.appointmentRepo.findOne({ where: { id: appointmentId } });

    if (!appointment) throw new NotFoundException('Appointment not found');

    if (appointment.patientId !== patientId) {
      throw new ForbiddenException('You can only reschedule your own appointments');
    }

    if (appointment.status === AppointmentStatus.CANCELLED) {
      throw new BadRequestException('Cannot reschedule a cancelled appointment');
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (new Date(appointment.date) < today) {
      throw new BadRequestException('Cannot reschedule past appointments');
    }

    this.validateFutureDate(dto.date);

    if (!dto.slotId) {
      throw new BadRequestException(
        'slotId is required. Use the id returned by GET /patient/availability/:doctorId?date=...',
      );
    }

    if (appointment.appointmentType === AppointmentType.STREAM) {
      return this.rescheduleStream(patientId, appointment, dto);
    } else {
      return this.rescheduleWave(appointment, dto);
    }
  }

  private async rescheduleStream(
    patientId: string,
    appointment: Appointment,
    dto: RescheduleAppointmentDto,
  ) {
    const newSlot = await this.streamSlotRepo.findOne({
      where: { id: dto.slotId, doctorId: appointment.doctorId, date: dto.date },
    });

    if (!newSlot) {
      throw new NotFoundException(
        `No stream slot found with id ${dto.slotId} for doctor on ${dto.date}`,
      );
    }

    if (newSlot.bookedCount >= newSlot.maxCapacity) {
      throw new ConflictException('New slot is fully booked');
    }

    if (appointment.streamSlotId === newSlot.id) {
      throw new BadRequestException('Cannot reschedule to the same slot');
    }

    // Free old slot
    if (appointment.streamSlotId) {
      const oldSlot = await this.streamSlotRepo.findOne({ where: { id: appointment.streamSlotId } });
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
    newSlot.patientId = patientId;
    await this.streamSlotRepo.save(newSlot);

    appointment.date = dto.date;
    appointment.streamSlotId = newSlot.id;
    appointment.startTime = newSlot.startTime;
    appointment.endTime = newSlot.endTime;
    appointment.status = AppointmentStatus.RESCHEDULED;
    await this.appointmentRepo.save(appointment);

    return {
      appointmentId: appointment.id,
      type: 'STREAM',
      status: 'RESCHEDULED',
      date: dto.date,
      appointmentTime: `${newSlot.startTime} – ${newSlot.endTime}`,
      message: 'Appointment rescheduled successfully',
    };
  }

  private async rescheduleWave(appointment: Appointment, dto: RescheduleAppointmentDto) {
    const newWave = await this.waveRepo.findOne({
      where: { id: dto.slotId, doctorId: appointment.doctorId, date: dto.date },
    });

    if (!newWave) {
      throw new NotFoundException(
        `No wave found with id ${dto.slotId} for doctor on ${dto.date}`,
      );
    }

    if (newWave.bookedCount >= newWave.maxPatients) {
      throw new ConflictException('New wave is full');
    }

    if (appointment.waveId === newWave.id) {
      throw new BadRequestException('Cannot reschedule to the same wave');
    }

    // Free old wave
    if (appointment.waveId) {
      const oldWave = await this.waveRepo.findOne({ where: { id: appointment.waveId } });
      if (oldWave && oldWave.bookedCount > 0) {
        oldWave.bookedCount -= 1;
        await this.waveRepo.save(oldWave);
      }
    }

    const tokenNumber = newWave.bookedCount + 1;
    newWave.bookedCount += 1;
    await this.waveRepo.save(newWave);

    appointment.date = dto.date;
    appointment.waveId = newWave.id;
    appointment.waveStartTime = newWave.startTime;
    appointment.waveEndTime = newWave.endTime;
    appointment.tokenNumber = tokenNumber;
    appointment.status = AppointmentStatus.RESCHEDULED;
    await this.appointmentRepo.save(appointment);

    return {
      appointmentId: appointment.id,
      type: 'WAVE',
      status: 'RESCHEDULED',
      date: dto.date,
      timeWindow: `${newWave.startTime} – ${newWave.endTime}`,
      tokenNumber,
      message: 'Appointment rescheduled successfully',
    };
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

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

  private validateFutureDate(date: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (new Date(date) < today) {
      throw new BadRequestException('Cannot book appointments for past dates');
    }
  }
}
