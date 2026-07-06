import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { WebhookController } from './webhook.controller';
import { BillingService } from './billing.service';

// EmailModule es @Global → EmailService disponible sin importarlo aquí.
@Module({
  controllers: [BillingController, WebhookController],
  providers: [BillingService],
  exports: [BillingService],
})
export class BillingModule {}
