import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { PatientService } from './patient.service';

@Controller('patient')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('PATIENT')
export class PatientController {
  constructor(private readonly patientService: PatientService) {}

 
  @Post('profile')
  @HttpCode(HttpStatus.CREATED)
  createProfile(@Req() req: any, @Body() dto: CreatePatientDto) {
    return this.patientService.createProfile(req.user.id, dto);
  }

  
  @Get('profile')
  getProfile(@Req() req: any) {
    return this.patientService.getProfile(req.user.id);
  }

 
  @Patch('profile')
  updateProfile(@Req() req: any, @Body() dto: UpdatePatientDto) {
    return this.patientService.updateProfile(req.user.id, dto);
  }
}
