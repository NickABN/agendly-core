import { Module } from '@nestjs/common';
import { PublicController } from './public.controller';
import { PublicService } from './public.service';
import { ClientAppointmentsService } from './client-appointments.service';

@Module({
  controllers: [PublicController],
  providers: [PublicService, ClientAppointmentsService],
})
export class PublicModule {}
