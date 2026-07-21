import { IsEmail, IsIn, IsString, MinLength } from 'class-validator';

export class SignupDto {
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email!: string;

  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters long' })
  password!: string;

  @IsIn(['DOCTOR', 'PATIENT'], { message: 'Role must be either DOCTOR or PATIENT' })
  role!: 'DOCTOR' | 'PATIENT';
}
