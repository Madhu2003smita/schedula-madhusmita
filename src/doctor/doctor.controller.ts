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
import { DoctorService } from './doctor.service';
import { CreateDoctorDto } from './dto/create-doctor.dto';
import { UpdateDoctorDto } from './dto/update-doctor.dto';

@Controller('doctor')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('DOCTOR')
export class DoctorController {
  constructor(private readonly doctorService: DoctorService) {}

  
  @Post('profile')
  @HttpCode(HttpStatus.CREATED)
  createProfile(@Req() req: any, @Body() dto: CreateDoctorDto) {
    return this.doctorService.createProfile(req.user.id, dto);
  }

  
  @Get('profile')
  getProfile(@Req() req: any) {
    return this.doctorService.getProfile(req.user.id);
  }

 
  @Patch('profile')
  updateProfile(@Req() req: any, @Body() dto: UpdateDoctorDto) {
    return this.doctorService.updateProfile(req.user.id, dto);
  }
}
