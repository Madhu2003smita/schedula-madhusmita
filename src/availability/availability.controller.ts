import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AppointmentService } from '../appointment/appointment.service';
import { BookAppointmentDto } from '../appointment/dto/book-appointment.dto';
import { AvailabilityService } from './availability.service';
import { CreateCustomAvailabilityDto } from './dto/create-custom-availability.dto';
import { CreateRecurringAvailabilityDto } from './dto/create-recurring-availability.dto';
import { UpdateRecurringAvailabilityDto } from './dto/update-recurring-availability.dto';

@Controller('doctor/availability')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('DOCTOR')
export class AvailabilityController {
  constructor(private readonly availabilityService: AvailabilityService) {}

  
  @Post()
  @HttpCode(HttpStatus.CREATED)
  createRecurring(@Req() req: any, @Body() dto: CreateRecurringAvailabilityDto) {
    return this.availabilityService.createRecurring(req.user.id, dto);
  }

  
  @Get()
  getRecurring(@Req() req: any) {
    return this.availabilityService.getRecurring(req.user.id);
  }

 
  @Patch(':id')
  updateRecurring(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateRecurringAvailabilityDto) {
    return this.availabilityService.updateRecurring(req.user.id, id, dto);
  }


  @Delete(':id')
  deleteRecurring(@Req() req: any, @Param('id') id: string) {
    return this.availabilityService.deleteRecurring(req.user.id, id);
  }

  
  @Post('override')
  @HttpCode(HttpStatus.CREATED)
  createCustom(@Req() req: any, @Body() dto: CreateCustomAvailabilityDto) {
    return this.availabilityService.createCustom(req.user.id, dto);
  }

 
  @Get('date')
  getByDate(@Req() req: any, @Query('date') date: string) {
    if (!date) {
      throw new Error('date query parameter is required (format: YYYY-MM-DD)');
    }
    return this.availabilityService.getAvailabilityByDate(req.user.id, date);
  }

  
  @Post(':id/generate')
  @HttpCode(HttpStatus.CREATED)
  generateSlots(
    @Req() req: any,
    @Param('id') availabilityId: string,
    @Query('date') date: string,
  ) {
    if (!date) {
      throw new Error('date query parameter is required (format: YYYY-MM-DD)');
    }
    return this.availabilityService.generateSlotsFromAvailability(req.user.id, availabilityId, date);
  }
}


@Controller('patient/availability')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('PATIENT')
export class PatientAvailabilityController {
  constructor(
    private readonly availabilityService: AvailabilityService,
    private readonly appointmentService: AppointmentService,
  ) {}

  /**
   * GET /patient/availability/:doctorId?date=YYYY-MM-DD
   * Returns generated slots with id, startTime, endTime, maxCapacity, remainingCapacity.
   * Use the returned slot/wave id when calling POST /appointment.
   */
  @Get(':doctorId')
  getSlots(@Param('doctorId') doctorId: string, @Query('date') date: string) {
    if (!date) {
      throw new Error('date query parameter is required (format: YYYY-MM-DD)');
    }
    return this.availabilityService.getGeneratedSlots(doctorId, date);
  }

  /**
   * POST /patient/availability/book/stream
   * Books a STREAM slot using the streamSlotId returned by GET /patient/availability/:doctorId.
   * Delegates to AppointmentService so the appointment can be cancelled/rescheduled via
   * PATCH /appointment/:id/cancel and PATCH /appointment/:id/reschedule.
   *
   * Body: { streamSlotId: string, doctorId: string, date: string }
   */
  @Post('book/stream')
  @HttpCode(HttpStatus.CREATED)
  bookStream(
    @Req() req: any,
    @Body() body: { streamSlotId: string; doctorId: string; date: string },
  ) {
    const dto: BookAppointmentDto = {
      doctorId: body.doctorId,
      date: body.date,
      streamSlotId: body.streamSlotId,
    };
    return this.appointmentService.bookAppointment(req.user.id, dto);
  }

  /**
   * POST /patient/availability/book/wave
   * Books a WAVE slot using the waveId returned by GET /patient/availability/:doctorId.
   * Delegates to AppointmentService so the appointment can be cancelled/rescheduled via
   * PATCH /appointment/:id/cancel and PATCH /appointment/:id/reschedule.
   *
   * Body: { waveId: string, doctorId: string, date: string }
   */
  @Post('book/wave')
  @HttpCode(HttpStatus.CREATED)
  bookWave(
    @Req() req: any,
    @Body() body: { waveId: string; doctorId: string; date: string },
  ) {
    const dto: BookAppointmentDto = {
      doctorId: body.doctorId,
      date: body.date,
      waveId: body.waveId,
    };
    return this.appointmentService.bookAppointment(req.user.id, dto);
  }
}
