import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AppointmentService } from './appointment.service';
import { BookAppointmentDto } from './dto/book-appointment.dto';
import { RescheduleAppointmentDto } from './dto/reschedule-appointment.dto';

@Controller('patient/appointment')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('PATIENT')
export class AppointmentController {
  constructor(private readonly appointmentService: AppointmentService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  bookAppointment(@Req() req: any, @Body() dto: BookAppointmentDto) {
    return this.appointmentService.bookAppointment(req.user.id, dto);
  }

  @Get('my')
  getMyAppointments(@Req() req: any) {
    return this.appointmentService.getMyAppointments(req.user.id);
  }

  @Patch(':id/cancel')
  cancelAppointment(@Req() req: any, @Param('id') id: string) {
    return this.appointmentService.cancelAppointment(req.user.id, id);
  }

  @Patch(':id/reschedule')
  rescheduleAppointment(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: RescheduleAppointmentDto,
  ) {
    return this.appointmentService.rescheduleAppointment(req.user.id, id, dto);
  }
}

@Controller('doctor/appointments')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('DOCTOR')
export class DoctorAppointmentController {
  constructor(private readonly appointmentService: AppointmentService) {}

  @Get()
  getDoctorAppointments(@Req() req: any) {
    return this.appointmentService.getDoctorAppointments(req.user.id);
  }
}
