import {
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import type { SubscriptionStatus } from '../generated/prisma/client.js';

/** Mapea el estado de la suscripción de Stripe a nuestro enum. */
function mapStripeStatus(
  status: Stripe.Subscription.Status,
): SubscriptionStatus {
  switch (status) {
    case 'trialing':
      return 'TRIALING';
    case 'active':
      return 'ACTIVE';
    case 'past_due':
      return 'PAST_DUE';
    case 'incomplete':
      return 'INCOMPLETE';
    default:
      // canceled, unpaid, incomplete_expired, paused
      return 'CANCELED';
  }
}

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  private readonly stripe: Stripe | null;
  private readonly priceId?: string;
  private readonly webhookSecret?: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly emailService: EmailService,
  ) {
    const key = this.config.get<string>('STRIPE_SECRET_KEY');
    this.stripe = key ? new Stripe(key) : null;
    this.priceId = this.config.get<string>('STRIPE_PRICE_ID');
    this.webhookSecret = this.config.get<string>('STRIPE_WEBHOOK_SECRET');
    if (!this.stripe) {
      this.logger.warn(
        'Stripe no configurado — los endpoints de billing responderán 503',
      );
    }
  }

  private client(): Stripe {
    if (!this.stripe) {
      throw new ServiceUnavailableException('Pagos no configurados');
    }
    return this.stripe;
  }

  private frontendUrl(): string {
    return this.config.get<string>('FRONTEND_URL', 'http://localhost:3001');
  }

  /** Crea (o reusa) el Customer de Stripe para el tenant. */
  private async ensureCustomer(tenantId: string): Promise<string> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { users: { where: { role: 'OWNER' }, take: 1 } },
    });
    if (!tenant) throw new NotFoundException('Negocio no encontrado');
    if (tenant.stripeCustomerId) return tenant.stripeCustomerId;

    const customer = await this.client().customers.create({
      name: tenant.name,
      email: tenant.users[0]?.email,
      metadata: { tenantId },
    });
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { stripeCustomerId: customer.id },
    });
    return customer.id;
  }

  async createCheckoutSession(tenantId: string): Promise<{ url: string }> {
    if (!this.priceId) {
      throw new ServiceUnavailableException('Plan de pago no configurado');
    }
    const customerId = await this.ensureCustomer(tenantId);
    const base = this.frontendUrl();

    const session = await this.client().checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: this.priceId, quantity: 1 }],
      success_url: `${base}/admin/subscription?checkout=success`,
      cancel_url: `${base}/admin/subscription?checkout=cancel`,
      metadata: { tenantId },
    });

    if (!session.url) {
      throw new ServiceUnavailableException('No se pudo iniciar el checkout');
    }
    return { url: session.url };
  }

  async createPortalSession(tenantId: string): Promise<{ url: string }> {
    const customerId = await this.ensureCustomer(tenantId);
    const session = await this.client().billingPortal.sessions.create({
      customer: customerId,
      return_url: `${this.frontendUrl()}/admin/subscription`,
    });
    return { url: session.url };
  }

  async getStatus(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        subscriptionStatus: true,
        trialEndsAt: true,
        currentPeriodEnd: true,
        stripeCustomerId: true,
      },
    });
    if (!tenant) throw new NotFoundException('Negocio no encontrado');

    const msLeft = tenant.trialEndsAt.getTime() - Date.now();
    return {
      subscriptionStatus: tenant.subscriptionStatus,
      trialEndsAt: tenant.trialEndsAt.toISOString(),
      currentPeriodEnd: tenant.currentPeriodEnd?.toISOString() ?? null,
      trialDaysRemaining: Math.max(0, Math.ceil(msLeft / 86_400_000)),
      hasStripeCustomer: !!tenant.stripeCustomerId,
      configured: !!this.priceId,
    };
  }

  /** Verifica la firma y devuelve el evento (raw body). */
  constructEvent(rawBody: Buffer, signature: string): Stripe.Event {
    if (!this.webhookSecret) {
      throw new ServiceUnavailableException('Webhook no configurado');
    }
    return this.client().webhooks.constructEvent(
      rawBody,
      signature,
      this.webhookSecret,
    );
  }

  /** Aplica el evento del webhook al estado del tenant. */
  async handleEvent(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        await this.syncSubscription(sub);
        break;
      }
      case 'invoice.paid': {
        const invoice = event.data.object;
        await this.onInvoicePaid(invoice);
        break;
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        await this.onInvoiceFailed(invoice);
        break;
      }
      default:
        this.logger.debug(`Evento de Stripe ignorado: ${event.type}`);
    }
  }

  private async syncSubscription(sub: Stripe.Subscription): Promise<void> {
    const customerId =
      typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
    const tenant = await this.prisma.tenant.findFirst({
      where: { stripeCustomerId: customerId },
    });
    if (!tenant) {
      this.logger.warn(`Webhook sin tenant para customer ${customerId}`);
      return;
    }

    const periodEnd = sub.items.data[0]?.current_period_end;
    await this.prisma.tenant.update({
      where: { id: tenant.id },
      data: {
        stripeSubscriptionId: sub.id,
        subscriptionStatus: mapStripeStatus(sub.status),
        currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
      },
    });
    this.logger.log(
      `Suscripción de ${tenant.slug} → ${mapStripeStatus(sub.status)}`,
    );
  }

  private async onInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
    const customerId =
      typeof invoice.customer === 'string'
        ? invoice.customer
        : invoice.customer?.id;
    if (!customerId) return;
    const tenant = await this.prisma.tenant.findFirst({
      where: { stripeCustomerId: customerId },
      include: { users: { where: { role: 'OWNER' }, take: 1 } },
    });
    if (!tenant) return;

    await this.prisma.tenant.update({
      where: { id: tenant.id },
      data: { subscriptionStatus: 'ACTIVE' },
    });

    const email = tenant.users[0]?.email;
    if (email) {
      this.emailService
        .sendPaymentReceipt({
          to: email,
          businessName: tenant.name,
          amount: (invoice.amount_paid / 100).toFixed(2),
          currency: invoice.currency.toUpperCase(),
          invoiceUrl: invoice.hosted_invoice_url ?? undefined,
        })
        .catch((err: Error) =>
          this.logger.error(`Fallo recibo de pago: ${err.message}`),
        );
    }
  }

  private async onInvoiceFailed(invoice: Stripe.Invoice): Promise<void> {
    const customerId =
      typeof invoice.customer === 'string'
        ? invoice.customer
        : invoice.customer?.id;
    if (!customerId) return;
    const tenant = await this.prisma.tenant.findFirst({
      where: { stripeCustomerId: customerId },
      include: { users: { where: { role: 'OWNER' }, take: 1 } },
    });
    if (!tenant) return;

    await this.prisma.tenant.update({
      where: { id: tenant.id },
      data: { subscriptionStatus: 'PAST_DUE' },
    });

    const email = tenant.users[0]?.email;
    if (email) {
      this.emailService
        .sendPaymentFailed({
          to: email,
          businessName: tenant.name,
          manageUrl: `${this.frontendUrl()}/admin/subscription`,
        })
        .catch((err: Error) =>
          this.logger.error(`Fallo aviso de dunning: ${err.message}`),
        );
    }
  }
}
