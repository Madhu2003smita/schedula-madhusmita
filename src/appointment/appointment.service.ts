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
    this.validateFutureDate(dto.date);

    // STREAM by slot ID (preferred)
    if (dto.streamSlotId) {
      return this.bookStreamAppointment(patientId, dto);
    }
    // STREAM by time range (legacy fallback)
    if (dto.startTime && dto.endTime) {
      return this.bookStreamAppointment(patientId, dto);
    }
    // WAVE by wave ID
    if (dto.waveId) {
      return this.bookWaveAppointment(patientId, dto);
    }

    throw new BadRequestException(
      'Provide streamSlotId for STREAM booking, waveId for WAVE booking, or startTime+endTime as a fallback for STREAM',
    );
  }

  private async bookStreamAppointment(patientId: string, dto: BookAppointmentDto) {
    let slot: StreamSlot | null;

    // Method 1: Direct lookup by slot ID (preferred)
    if (dto.streamSlotId) {
      slot = await this.streamSlotRepo.findOne({
        where: {
          id: dto.streamSlotId,
          doctorId: dto.doctorId,
          date: dto.date,
        },
      });

      if (!slot) {
        throw new NotFoundException(
          `Stream slot with ID ${dto.streamSlotId} not found for doctor on ${dto.date}`,
        );
      }
    }
    // Method 2: Lookup by time range (legacy fallback)
    else if (dto.startTime && dto.endTime) {
      const normalizedStart = this.normalizeTime(dto.startTime);
      const normalizedEnd = this.normalizeTime(dto.endTime);

      slot = await this.streamSlotRepo.findOne({
        where: {
          doctorId: dto.doctorId,
          date: dto.date,
          startTime: normalizedStart,
          endTime: normalizedEnd,
        },
      });

      if (!slot) {
        throw new NotFoundException(
          `No stream slot found for doctor on ${dto.date} at ${dto.startTime}-${dto.endTime}`,
        );
      }
    } else {
      throw new BadRequestException(
        'Either streamSlotId or both startTime and endTime are required for STREAM booking',
      );
    }

    if (slot.isBooked) {
      throw new ConflictException('This slot is already booked');
    }

    const existing = await this.appointmentRepo.findOne({
      where: {
        patientId,
        doctorId: dto.doctorId,
        date: dto.date,
        appointmentType: AppointmentType.STREAM,
        status: AppointmentStatus.BOOKED,
      },
    });
    if (existing) {
      throw new ConflictException('You already have a booked appointment with this doctor on this date');
    }

    slot.isBooked = true;
    slot.patientId = patientId;
    await this.streamSlotRepo.save(slot);

    const appointment = this.appointmentRepo.create({
      patientId,
      doctorId: dto.doctorId,
      date: dto.date,
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
      doctorId: dto.doctorId,
      date: dto.date,
      appointmentTime: `${slot.startTime} – ${slot.endTime}`,
      message: 'Appointment booked successfully',
    };
  }

  private async bookWaveAppointment(patientId: string, dto: BookAppointmentDto) {
    const wave = await this.waveRepo.findOne({
      where: { id: dto.waveId, doctorId: dto.doctorId },
    });

    if (!wave) {
      throw new NotFoundException('Wave not found for this doctor');
    }

  
    if (wave.date !== dto.date) {
      throw new BadRequestException(`Wave date (${wave.date}) does not match requested date (${dto.date})`);
    }

    
    if (wave.bookedCount >= wave.maxPatients) {
      throw new ConflictException('This wave is full. No more bookings allowed.');
    }

    const existing = await this.appointmentRepo.findOne({
      where: {
        patientId,
        waveId: dto.waveId,
        status: AppointmentStatus.BOOKED,
      },
    });
    if (existing) {
      throw new ConflictException('You have already booked this wave');
    }

    
    const tokenNumber = wave.bookedCount + 1;
    wave.bookedCount += 1;
    await this.waveRepo.save(wave);


    const appointment = this.appointmentRepo.create({
      patientId,
      doctorId: dto.doctorId,
      date: dto.date,
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
      doctorId: dto.doctorId,
      date: dto.date,
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



  async cancelAppointment(patientId: string, appointmentId: string) {
    const appointment = await this.appointmentRepo.findOne({
      where: { id: appointmentId },
    });

    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    
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

    
    if (appointment.appointmentType === AppointmentType.STREAM && appointment.streamSlotId) {
      const slot = await this.streamSlotRepo.findOne({
        where: { id: appointment.streamSlotId },
      });
      if (slot) {
        slot.isBooked = false;
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

  
  private normalizeTime(time: string): string {
    if (!time) return time;
    const parts = time.split(':');
    if (parts.length === 2) return `${time}:00`;
    return time;
  }

  

  async rescheduleAppointment(patientId: string, appointmentId: string, dto: RescheduleAppointmentDto) {
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

    if (appointment.appointmentType === AppointmentType.STREAM) {
      return this.rescheduleStream(patientId, appointment, dto);
    } else {
      return this.rescheduleWave(patientId, appointment, dto);
    }
  }

  private async rescheduleStream(patientId: string, appointment: Appointment, dto: RescheduleAppointmentDto) {
    let newSlot: StreamSlot | null;

    // Method 1: Direct lookup by slot ID (preferred)
    if (dto.streamSlotId) {
      newSlot = await this.streamSlotRepo.findOne({
        where: {
          id: dto.streamSlotId,
          doctorId: appointment.doctorId,
          date: dto.date,
        },
      });

      if (!newSlot) {
        throw new NotFoundException(
          `Stream slot with ID ${dto.streamSlotId} not found for doctor on ${dto.date}`,
        );
      }
    }
    // Method 2: Lookup by time range (legacy fallback)
    else if (dto.startTime && dto.endTime) {
      const normalizedStart = this.normalizeTime(dto.startTime);
      const normalizedEnd = this.normalizeTime(dto.endTime);

      newSlot = await this.streamSlotRepo.findOne({
        where: { doctorId: appointment.doctorId, date: dto.date, startTime: normalizedStart, endTime: normalizedEnd },
      });

      if (!newSlot) {
        throw new NotFoundException(`No stream slot found on ${dto.date} at ${dto.startTime}-${dto.endTime}`);
      }
    } else {
      throw new BadRequestException('streamSlotId or both startTime and endTime required for STREAM rescheduling');
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
      if (oldSlot && oldSlot.bookedCount > 0) {
        oldSlot.bookedCount -= 1;
        oldSlot.isBooked = false;
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

  private async rescheduleWave(patientId: string, appointment: Appointment, dto: RescheduleAppointmentDto) {
    if (!dto.waveId) throw new BadRequestException('waveId required for WAVE rescheduling');

    const newWave = await this.waveRepo.findOne({ where: { id: dto.waveId, doctorId: appointment.doctorId } });

    if (!newWave) throw new NotFoundException('New wave slot not found');
    if (newWave.bookedCount >= newWave.maxPatients) throw new ConflictException('New wave is full');
    if (appointment.waveId === newWave.id) throw new BadRequestException('Cannot reschedule to the same wave');

    
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
}
