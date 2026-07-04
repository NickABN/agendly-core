import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';
import { SchedulesService } from './schedules.service';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { BulkScheduleDto } from './dto/bulk-schedule.dto';

@Controller('schedules')
@UseGuards(JwtAuthGuard, TenantGuard)
export class SchedulesController {
  constructor(private readonly schedulesService: SchedulesService) {}

  @Get()
  findAll(@CurrentTenant() tenantId: string) {
    return this.schedulesService.findAllByTenant(tenantId);
  }

  @Get('employee/:employeeId')
  findByEmployee(
    @CurrentTenant() tenantId: string,
    @Param('employeeId') employeeId: string,
  ) {
    return this.schedulesService.findByEmployee(tenantId, employeeId);
  }

  @Post()
  create(@CurrentTenant() tenantId: string, @Body() dto: CreateScheduleDto) {
    return this.schedulesService.create(tenantId, dto);
  }

  @Put('bulk')
  bulkSet(@CurrentTenant() tenantId: string, @Body() dto: BulkScheduleDto) {
    return this.schedulesService.bulkSet(tenantId, dto);
  }

  @Post('employee/:employeeId/default')
  createDefault(
    @CurrentTenant() tenantId: string,
    @Param('employeeId') employeeId: string,
  ) {
    return this.schedulesService.createDefault(tenantId, employeeId);
  }
}
