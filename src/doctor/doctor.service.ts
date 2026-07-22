import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateDoctorDto } from './dto/create-doctor.dto';
import { UpdateDoctorDto } from './dto/update-doctor.dto';
import { Doctor } from './doctor.entity';

@Injectable()
export class DoctorService {
  constructor(
    @InjectRepository(Doctor)
    private readonly doctorRepository: Repository<Doctor>,
  ) {}

  async createProfile(userId: string, dto: CreateDoctorDto): Promise<Doctor> {
    const existing = await this.doctorRepository.findOne({ where: { userId } });

    if (existing) {
      throw new ConflictException('Doctor profile already exists');
    }

    const doctor = this.doctorRepository.create({ userId, ...dto });
    return this.doctorRepository.save(doctor);
  }

  async getProfile(userId: string): Promise<Doctor> {
    const doctor = await this.doctorRepository.findOne({ where: { userId } });

    if (!doctor) {
      throw new NotFoundException('Doctor profile not found. Please create one first.');
    }

    return doctor;
  }

  async updateProfile(userId: string, dto: UpdateDoctorDto): Promise<Doctor> {
    const doctor = await this.getProfile(userId);
    Object.assign(doctor, dto);
    return this.doctorRepository.save(doctor);
  }
}
