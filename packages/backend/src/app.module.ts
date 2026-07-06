import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { SentryModule } from '@sentry/nestjs/setup';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { TenantModule } from './tenant/tenant.module';
import { ServicesModule } from './services/services.module';
import { EmployeesModule } from './employees/employees.module';
import { SchedulesModule } from './schedules/schedules.module';
import { AvailabilityModule } from './availability/availability.module';
import { PublicModule } from './public/public.module';
import { EmailModule } from './email/email.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { ProfileModule } from './profile/profile.module';
import { HealthModule } from './health/health.module';
import { BillingModule } from './billing/billing.module';
import { validate } from './config/env.validation';
import { loggerConfig } from './config/logger.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate,
    }),
    // Sentry (no-op sin SENTRY_DSN; la init real está en instrument.ts)
    SentryModule.forRoot(),
    // Logging estructurado JSON + request-id (ver logger.config.ts)
    LoggerModule.forRoot(loggerConfig()),
    // Rate limiting global; los endpoints públicos tienen límites más estrictos vía @Throttle
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    PrismaModule,
    AuthModule,
    TenantModule,
    ServicesModule,
    EmployeesModule,
    SchedulesModule,
    AvailabilityModule,
    PublicModule,
    EmailModule,
    AppointmentsModule,
    ProfileModule,
    HealthModule,
    BillingModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
