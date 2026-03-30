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
  Put,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';
import { ServicesService } from './services.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';

@Controller('services')
@UseGuards(JwtAuthGuard, TenantGuard)
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Get()
  findAll(@CurrentTenant() tenantId: string) {
    return this.servicesService.findAll(tenantId);
  }

  @Post()
  create(
    @CurrentTenant() tenantId: string,
    @Body() dto: CreateServiceDto,
  ) {
    return this.servicesService.create(tenantId, dto);
  }

  @Post('batch')
  createMany(
    @CurrentTenant() tenantId: string,
    @Body() dtos: CreateServiceDto[],
  ) {
    return this.servicesService.createMany(tenantId, dtos);
  }

  @Patch(':id')
  update(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateServiceDto,
  ) {
    return this.servicesService.update(tenantId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.servicesService.remove(tenantId, id);
  }

  @Get(':id/availability')
  getAvailability(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.servicesService.getAvailability(tenantId, id);
  }

  @Put(':id/availability')
  setAvailability(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() items: Array<{ dayOfWeek: string; startTime?: string; endTime?: string }>,
  ) {
    return this.servicesService.setAvailability(tenantId, id, items);
  }
}
