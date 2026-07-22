import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreatePatientDto {
  @IsString()
  fullName!: string;

  @IsInt()
  @Min(0)
  age!: number;

  @IsIn(['MALE', 'FEMALE', 'OTHER'])
  gender!: string;

  @IsString()
  contactNumber!: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  healthInfo?: string;
}
