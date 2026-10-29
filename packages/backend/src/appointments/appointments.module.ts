import { Module } from '@nestjs/common';
import { AppointmentsController } from './appointments.controller';
import { AppointmentsService } from './appointments.service';
import { ClientsService } from './clients.service';
import { InsightsModule } from '../insights/insights.module';
import { AvailabilityModule } from '../availability/availability.module';

@Module({
  imports: [InsightsModule, AvailabilityModule],
  controllers: [AppointmentsController],
  providers: [AppointmentsService, ClientsService],
  exports: [AppointmentsService],
})
export class AppointmentsModule {}
