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
import { UpdateCustomAvailabilityDto } from './dto/update-custom-availability.dto';

@Controller('doctor/availability')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('DOCTOR')
export class AvailabilityController {
  constructor(private readonly availabilityService: AvailabilityService) {}

  // ── Recurring ──────────────────────────────────────────────────────────────

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
  updateRecurring(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateRecurringAvailabilityDto,
  ) {
    return this.availabilityService.updateRecurring(req.user.id, id, dto);
  }

  @Delete(':id')
  deleteRecurring(@Req() req: any, @Param('id') id: string) {
    return this.availabilityService.deleteRecurring(req.user.id, id);
  }

  // ── Custom (Override) ──────────────────────────────────────────────────────

  @Post('override')
  @HttpCode(HttpStatus.CREATED)
  createCustom(@Req() req: any, @Body() dto: CreateCustomAvailabilityDto) {
    return this.availabilityService.createCustom(req.user.id, dto);
  }

  
  @Patch('override/:id')
  updateCustom(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateCustomAvailabilityDto,
  ) {
    return this.availabilityService.updateCustom(req.user.id, id, dto);
  }

  // ── By Date / Generate ────────────────────────────────────────────────────

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

 
  @Get(':doctorId')
  getSlots(@Param('doctorId') doctorId: string, @Query('date') date: string) {
    if (!date) {
      throw new Error('date query parameter is required (format: YYYY-MM-DD)');
    }
    return this.availabilityService.getGeneratedSlots(doctorId, date);
  }

  
  @Post('book')
  @HttpCode(HttpStatus.CREATED)
  book(
    @Req() req: any,
    @Body() body: { slotId: string; doctorId: string; date: string },
  ) {
    const dto: BookAppointmentDto = {
      doctorId: body.doctorId,
      date: body.date,
      slotId: body.slotId,
    };
    return this.appointmentService.bookAppointment(req.user.id, dto);
  }

 
  @Post('book/stream')
  @HttpCode(HttpStatus.CREATED)
  bookStream(
    @Req() req: any,
    @Body() body: { slotId: string; doctorId: string; date: string },
  ) {
    const dto: BookAppointmentDto = {
      doctorId: body.doctorId,
      date: body.date,
      slotId: body.slotId,
    };
    return this.appointmentService.bookAppointment(req.user.id, dto);
  }


  @Post('book/wave')
  @HttpCode(HttpStatus.CREATED)
  bookWave(
    @Req() req: any,
    @Body() body: { slotId: string; doctorId: string; date: string },
  ) {
    const dto: BookAppointmentDto = {
      doctorId: body.doctorId,
      date: body.date,
      slotId: body.slotId,
    };
    return this.appointmentService.bookAppointment(req.user.id, dto);
  }
}
