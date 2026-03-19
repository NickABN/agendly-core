import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';
import { AppointmentsService } from './appointments.service';

@Controller('appointments')
@UseGuards(JwtAuthGuard, TenantGuard)
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Get('day')
  findByDate(
    @CurrentTenant() tenantId: string,
    @Query('date') date: string,
  ) {
    return this.appointmentsService.findByDate(tenantId, date);
  }

  @Get('week')
  findByWeek(
    @CurrentTenant() tenantId: string,
    @Query('startDate') startDate: string,
  ) {
    return this.appointmentsService.findByWeek(tenantId, startDate);
  }

  @Patch(':id/status')
  updateStatus(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() body: { status: string; cancellationReason?: string },
  ) {
    return this.appointmentsService.updateStatus(
      tenantId,
      id,
      body.status,
      body.cancellationReason,
    );
  }
}
