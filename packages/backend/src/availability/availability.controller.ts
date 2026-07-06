import {
  Body,
  Controller,
  Get,
  Ip,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';
import { AvailabilityService } from './availability.service';
import { BookingService } from './booking.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { CheckAvailabilityDto } from './dto/check-availability.dto';
import { AppointmentChannel } from '@agendly/shared';

@Controller('availability')
export class AvailabilityController {
  constructor(
    private readonly availabilityService: AvailabilityService,
    private readonly bookingService: BookingService,
  ) {}

  /**
   * Public endpoint — used by the booking form.
   * Supports employeeId = "any" for a real any-available search.
   */
  @Get('slots')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  getSlots(@Query() query: CheckAvailabilityDto) {
    return this.availabilityService.getPublicSlots(query);
  }

  /**
   * Public endpoint — creates a booking from the public form.
   */
  @Post('book')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  publicBook(
    @Query('tenantSlug') tenantSlug: string,
    @Body() dto: CreateBookingDto,
    @Ip() clientIp: string,
  ) {
    return this.bookingService.createPublicBooking(tenantSlug, dto, clientIp);
  }

  /**
   * Authenticated endpoint — admin creates a booking (walk-in / manual).
   */
  @Post('admin/book')
  @UseGuards(JwtAuthGuard, TenantGuard)
  adminBook(@CurrentTenant() tenantId: string, @Body() dto: CreateBookingDto) {
    return this.bookingService.createBooking(tenantId, {
      ...dto,
      channel: AppointmentChannel.MANUAL,
    });
  }
}
