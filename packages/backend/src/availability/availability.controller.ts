import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';
import { AvailabilityService } from './availability.service';
import { BookingService } from './booking.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { PrismaService } from '../prisma/prisma.service';

@Controller('availability')
export class AvailabilityController {
  constructor(
    private readonly availabilityService: AvailabilityService,
    private readonly bookingService: BookingService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Public endpoint — used by the booking form.
   * Query params: tenantSlug, employeeId, serviceId, date (YYYY-MM-DD)
   */
  @Get('slots')
  async getSlots(
    @Query('tenantSlug') tenantSlug: string,
    @Query('employeeId') employeeId: string,
    @Query('serviceId') serviceId: string,
    @Query('date') date: string,
  ) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug: tenantSlug },
    });

    if (!tenant) return [];

    const service = await this.prisma.service.findFirst({
      where: { id: serviceId, tenantId: tenant.id, deletedAt: null },
    });

    if (!service) return [];

    return this.availabilityService.getAvailableSlots({
      tenantId: tenant.id,
      employeeId,
      serviceId,
      date,
      serviceDurationMinutes: service.durationMinutes,
      bufferMinutes: service.bufferMinutes,
    });
  }

  /**
   * Public endpoint — creates a booking from the public form.
   */
  @Post('book')
  async publicBook(
    @Query('tenantSlug') tenantSlug: string,
    @Body() dto: CreateBookingDto,
  ) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug: tenantSlug },
    });

    if (!tenant) {
      throw new Error('Negocio no encontrado');
    }

    return this.bookingService.createBooking(tenant.id, dto);
  }

  /**
   * Authenticated endpoint — admin creates a booking (walk-in / manual).
   */
  @Post('admin/book')
  @UseGuards(JwtAuthGuard, TenantGuard)
  adminBook(
    @CurrentTenant() tenantId: string,
    @Body() dto: CreateBookingDto,
  ) {
    return this.bookingService.createBooking(tenantId, {
      ...dto,
      channel: 'MANUAL' as any,
    });
  }
}
