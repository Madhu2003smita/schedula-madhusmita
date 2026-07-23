import { IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateDoctorDto {
  @IsString()
  fullName!: string;

  @IsString()
  specialization!: string;

  @IsInt()
  @Min(0)
  experienceYears!: number;

  @IsString()
  qualification!: string;

  @IsNumber()
  @Min(0)
  consultationFee!: number;

  @IsString()
  availabilityHours!: string;

  @IsOptional()
  @IsString()
  profileDetails?: string;
}
