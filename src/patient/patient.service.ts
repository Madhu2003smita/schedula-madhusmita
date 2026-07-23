import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { Patient } from './patient.entity';

@Injectable()
export class PatientService {
  constructor(
    @InjectRepository(Patient)
    private readonly patientRepository: Repository<Patient>,
  ) {}

  async createProfile(userId: string, dto: CreatePatientDto): Promise<Patient> {
    const existing = await this.patientRepository.findOne({ where: { userId } });

    if (existing) {
      throw new ConflictException('Patient profile already exists');
    }

    const patient = this.patientRepository.create({ userId, ...dto });
    return this.patientRepository.save(patient);
  }

  async getProfile(userId: string): Promise<Patient> {
    const patient = await this.patientRepository.findOne({ where: { userId } });

    if (!patient) {
      throw new NotFoundException('Patient profile not found. Please create one first.');
    }

    return patient;
  }

  async updateProfile(userId: string, dto: UpdatePatientDto): Promise<Patient> {
    const patient = await this.getProfile(userId);
    Object.assign(patient, dto);
    return this.patientRepository.save(patient);
  }
}
