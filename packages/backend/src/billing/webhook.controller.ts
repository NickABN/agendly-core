import {
  BadRequestException,
  Controller,
  Headers,
  HttpCode,
  Logger,
  Post,
  Req,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { BillingService } from './billing.service';

/**
 * Webhook de Stripe. Público (Stripe no autentica con nuestro JWT) pero
 * verificado por firma sobre el BODY CRUDO (por eso rawBody en main.ts y
 * @Req en vez de un DTO — el ValidationPipe no debe tocarlo).
 */
@Controller('billing')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(private readonly billing: BillingService) {}

  @Post('webhook')
  @HttpCode(200)
  @SkipThrottle()
  async handle(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    if (!req.rawBody) {
      throw new BadRequestException('Falta el cuerpo crudo');
    }
    let event;
    try {
      event = this.billing.constructEvent(req.rawBody, signature);
    } catch (err) {
      this.logger.warn(
        `Firma de webhook inválida: ${err instanceof Error ? err.message : ''}`,
      );
      throw new BadRequestException('Firma inválida');
    }

    await this.billing.handleEvent(event);
    return { received: true };
  }
}
