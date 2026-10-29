import { Global, Module } from '@nestjs/common';
import { EmailService } from './email.service';
import { AppointmentLinkService } from './appointment-link.service';

@Global()
@Module({
  providers: [EmailService, AppointmentLinkService],
  exports: [EmailService, AppointmentLinkService],
})
export class EmailModule {}
