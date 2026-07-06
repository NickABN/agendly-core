import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';
import { BillingService } from './billing.service';

/**
 * Rutas de billing del tenant. Guardadas por auth+tenant pero EXENTAS del
 * SubscriptionGuard: un tenant con la prueba vencida debe poder entrar aquí
 * justamente para pagar.
 */
@Controller('billing')
@UseGuards(JwtAuthGuard, TenantGuard)
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Get('status')
  status(@CurrentTenant() tenantId: string) {
    return this.billing.getStatus(tenantId);
  }

  @Post('checkout')
  checkout(@CurrentTenant() tenantId: string) {
    return this.billing.createCheckoutSession(tenantId);
  }

  @Post('portal')
  portal(@CurrentTenant() tenantId: string) {
    return this.billing.createPortalSession(tenantId);
  }
}
