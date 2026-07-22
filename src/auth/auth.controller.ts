import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { Roles } from './roles.decorator';
import { RolesGuard } from './roles.guard';

@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  
  @Post('signup')
  @HttpCode(HttpStatus.CREATED)
  signup(@Body() dto: SignupDto) {
    return this.authService.signup(dto);
  }

 
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

 
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('DOCTOR')
  @Get('doctor/profile')
  doctorProfile(@Req() req: any) {
    return {
      message: 'Welcome, Doctor! This is your protected profile.',
      user: req.user,
    };
  }

  
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PATIENT')
  @Get('patient/profile')
  patientProfile(@Req() req: any) {
    return {
      message: 'Welcome, Patient! This is your protected profile.',
      user: req.user,
    };
  }
}
