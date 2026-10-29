import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { PublicService } from './public.service';
import { ClientAppointmentsService } from './client-appointments.service';
import { ClientCancelDto } from './dto/client-cancel.dto';

@Controller('public')
export class PublicController {
  constructor(
    private readonly publicService: PublicService,
    private readonly clientAppointments: ClientAppointmentsService,
  ) {}

  /** GET /public/appointments/:token — client self-service view (signed email link) */
  @Get('appointments/:token')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  getClientAppointment(@Param('token') token: string) {
    return this.clientAppointments.findByToken(token);
  }

  /** POST /public/appointments/:token/cancel — the client cancels their own appointment */
  @Post('appointments/:token/cancel')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  cancelClientAppointment(
    @Param('token') token: string,
    @Body() body: ClientCancelDto,
  ) {
    return this.clientAppointments.cancel(token, body.reason);
  }

  /** GET /public/:slug — returns tenant info, services, and employees */
  @Get(':slug')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  getTenantBySlug(@Param('slug') slug: string) {
    return this.publicService.getTenantBySlug(slug);
  }
}
