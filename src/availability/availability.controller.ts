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
}
