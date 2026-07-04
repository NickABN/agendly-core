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
import { ClientsService } from './clients.service';
import { UpdateStatusDto } from './dto/update-status.dto';
import type { AppointmentStatus } from '../generated/prisma/client.js';

@Controller('appointments')
@UseGuards(JwtAuthGuard, TenantGuard)
export class AppointmentsController {
  constructor(
    private readonly appointmentsService: AppointmentsService,
    private readonly clientsService: ClientsService,
  ) {}

  @Get('clients')
  findClients(@CurrentTenant() tenantId: string) {
    return this.clientsService.findClients(tenantId);
  }

  @Get('month')
  findByMonth(
    @CurrentTenant() tenantId: string,
    @Query('year') year: string,
    @Query('month') month: string,
  ) {
    return this.appointmentsService.findByMonth(
      tenantId,
      parseInt(year),
      parseInt(month),
    );
  }

  @Get('day')
  findByDate(@CurrentTenant() tenantId: string, @Query('date') date: string) {
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
    @Body() body: UpdateStatusDto,
  ) {
    return this.appointmentsService.updateStatus(
      tenantId,
      id,
      body.status as unknown as AppointmentStatus,
      body.cancellationReason,
    );
  }
}
