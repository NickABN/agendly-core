import {
  Injectable,
  ConflictException,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import type { SubscriptionStatus } from '../generated/prisma/client.js';

const WEBHOOK_CLAIM_LEASE_MS = 5 * 60 * 1000;

type BillingTransaction = Pick<PrismaService, 'tenant' | 'stripeWebhookEvent'>;
type WebhookNotification =
  | {
      kind: 'receipt';
      data: {
        to: string;
        businessName: string;
        amount: string;
        currency: string;
        invoiceUrl?: string;
      };
    }
  | {
      kind: 'payment-failed';
      data: { to: string; businessName: string; manageUrl: string };
    };

type StoredNotification =
  | {
      kind: 'receipt';
      amount: string;
      currency: string;
      invoiceUrl?: string | null;
    }
  | { kind: 'payment-failed' };

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
    const claimToken = await this.claimWebhookEvent(event.id);
    if (!claimToken) return this.resendPendingNotification(event.id);

    try {
      const notification = await this.prisma.$transaction(async (tx) => {
        const notification = await this.processEvent(tx, event, claimToken);
        const completion = await tx.stripeWebhookEvent.updateMany({
          where: { eventId: event.id, claimToken, status: 'PROCESSING' },
          data: {
            status: 'COMPLETED',
            completedAt: new Date(),
            notification: notification
              ? toStoredNotification(notification)
              : undefined,
          },
        });
        if (completion.count !== 1) {
          throw new ServiceUnavailableException(
            'No se pudo completar el webhook',
          );
        }
        return notification;
      });
      if (notification) await this.deliverNotification(event.id, notification);
    } catch (error) {
      // Scoped to PROCESSING so a failed delivery never drops the COMPLETED
      // row that guarantees idempotency.
      await this.prisma.stripeWebhookEvent
        .deleteMany({
          where: { eventId: event.id, claimToken, status: 'PROCESSING' },
        })
        .catch((cleanupError: unknown) => {
          this.logger.error(
            `No se pudo liberar el evento de Stripe: ${
              cleanupError instanceof Error
                ? cleanupError.message
                : 'error desconocido'
            }`,
          );
        });
      throw error;
    }
  }

  private async processEvent(
    tx: BillingTransaction,
    event: Stripe.Event,
    claimToken: string,
  ): Promise<WebhookNotification | undefined> {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await this.syncSubscription(
          tx,
          event.id,
          claimToken,
          event.data.object,
        );
        return;
      case 'invoice.paid':
        return this.onInvoicePaid(tx, event.id, claimToken, event.data.object);
      case 'invoice.payment_failed':
        return this.onInvoiceFailed(
          tx,
          event.id,
          claimToken,
          event.data.object,
        );
      default:
        this.logger.debug(`Evento de Stripe ignorado: ${event.type}`);
    }
  }

  private async claimWebhookEvent(eventId: string): Promise<string | null> {
    const now = new Date();
    const claimToken = randomUUID();
    const leaseExpiresAt = new Date(now.getTime() + WEBHOOK_CLAIM_LEASE_MS);

    try {
      await this.prisma.stripeWebhookEvent.create({
        data: { eventId, claimToken, leaseExpiresAt },
      });
      return claimToken;
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;
    }

    const existing = await this.prisma.stripeWebhookEvent.findUnique({
      where: { eventId },
    });
    if (!existing) throw new ConflictException('Webhook en procesamiento');
    if (existing.status === 'COMPLETED') return null;
    if (existing.leaseExpiresAt > now) {
      throw new ConflictException('Webhook en procesamiento');
    }

    const takeover = await this.prisma.stripeWebhookEvent.updateMany({
      where: {
        eventId,
        status: 'PROCESSING',
        leaseExpiresAt: { lt: now },
      },
      data: {
        claimToken,
        claimedAt: now,
        leaseExpiresAt,
      },
    });
    if (takeover.count === 1) return claimToken;

    const current = await this.prisma.stripeWebhookEvent.findUnique({
      where: { eventId },
    });
    if (current?.status === 'COMPLETED') return null;
    throw new ConflictException('Webhook en procesamiento');
  }

  private async syncSubscription(
    tx: BillingTransaction,
    eventId: string,
    claimToken: string,
    sub: Stripe.Subscription,
  ): Promise<void> {
    const customerId =
      typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
    const tenant = await tx.tenant.findFirst({
      where: { stripeCustomerId: customerId },
    });
    if (!tenant) {
      this.logger.warn(`Webhook sin tenant para customer ${customerId}`);
      return;
    }

    const periodEnd = sub.items.data[0]?.current_period_end;
    await this.assignTenant(tx, eventId, claimToken, tenant.id);
    await tx.tenant.update({
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

  private async onInvoicePaid(
    tx: BillingTransaction,
    eventId: string,
    claimToken: string,
    invoice: Stripe.Invoice,
  ): Promise<WebhookNotification | undefined> {
    const customerId =
      typeof invoice.customer === 'string'
        ? invoice.customer
        : invoice.customer?.id;
    if (!customerId) return;
    const tenant = await tx.tenant.findFirst({
      where: { stripeCustomerId: customerId },
      include: { users: { where: { role: 'OWNER' }, take: 1 } },
    });
    if (!tenant) return;

    await this.assignTenant(tx, eventId, claimToken, tenant.id);
    await tx.tenant.update({
      where: { id: tenant.id },
      data: { subscriptionStatus: 'ACTIVE' },
    });

    const email = tenant.users[0]?.email;
    return email
      ? {
          kind: 'receipt',
          data: {
            to: email,
            businessName: tenant.name,
            amount: (invoice.amount_paid / 100).toFixed(2),
            currency: invoice.currency.toUpperCase(),
            invoiceUrl: invoice.hosted_invoice_url ?? undefined,
          },
        }
      : undefined;
  }

  private async onInvoiceFailed(
    tx: BillingTransaction,
    eventId: string,
    claimToken: string,
    invoice: Stripe.Invoice,
  ): Promise<WebhookNotification | undefined> {
    const customerId =
      typeof invoice.customer === 'string'
        ? invoice.customer
        : invoice.customer?.id;
    if (!customerId) return;
    const tenant = await tx.tenant.findFirst({
      where: { stripeCustomerId: customerId },
      include: { users: { where: { role: 'OWNER' }, take: 1 } },
    });
    if (!tenant) return;

    await this.assignTenant(tx, eventId, claimToken, tenant.id);
    await tx.tenant.update({
      where: { id: tenant.id },
      data: { subscriptionStatus: 'PAST_DUE' },
    });

    const email = tenant.users[0]?.email;
    return email
      ? {
          kind: 'payment-failed',
          data: {
            to: email,
            businessName: tenant.name,
            manageUrl: `${this.frontendUrl()}/admin/subscription`,
          },
        }
      : undefined;
  }

  /** Envía y sólo entonces marca entregado; si falla, Stripe reintenta. */
  private async deliverNotification(
    eventId: string,
    notification: WebhookNotification,
  ): Promise<void> {
    try {
      if (notification.kind === 'receipt') {
        await this.emailService.sendPaymentReceipt(notification.data);
      } else {
        await this.emailService.sendPaymentFailed(notification.data);
      }
    } catch (err) {
      this.logger.error(
        `Fallo notificación de pago: ${
          err instanceof Error ? err.message : 'error desconocido'
        }`,
      );
      throw new ServiceUnavailableException(
        'No se pudo enviar la notificación',
      );
    }

    await this.prisma.stripeWebhookEvent.updateMany({
      where: { eventId },
      data: { notifiedAt: new Date() },
    });
  }

  /** Reenvía la notificación pendiente de un evento ya completado. */
  private async resendPendingNotification(eventId: string): Promise<void> {
    const stored = await this.prisma.stripeWebhookEvent.findUnique({
      where: { eventId },
    });
    if (!stored?.tenantId || !stored.notification || stored.notifiedAt) return;

    const tenant = await this.prisma.tenant.findFirst({
      where: { id: stored.tenantId },
      include: { users: { where: { role: 'OWNER' }, take: 1 } },
    });
    const to = tenant?.users[0]?.email;
    if (!tenant || !to) return;

    const pending = stored.notification as StoredNotification;
    await this.deliverNotification(
      eventId,
      pending.kind === 'receipt'
        ? {
            kind: 'receipt',
            data: {
              to,
              businessName: tenant.name,
              amount: pending.amount,
              currency: pending.currency,
              invoiceUrl: pending.invoiceUrl ?? undefined,
            },
          }
        : {
            kind: 'payment-failed',
            data: {
              to,
              businessName: tenant.name,
              manageUrl: `${this.frontendUrl()}/admin/subscription`,
            },
          },
    );
  }

  private async assignTenant(
    tx: BillingTransaction,
    eventId: string,
    claimToken: string,
    tenantId: string,
  ): Promise<void> {
    const assigned = await tx.stripeWebhookEvent.updateMany({
      where: { eventId, claimToken, status: 'PROCESSING' },
      data: { tenantId },
    });
    if (assigned.count !== 1) {
      throw new ServiceUnavailableException('No se pudo asociar el webhook');
    }
  }
}

function isUniqueConstraintError(error: unknown): boolean {
  return (error as { code?: string }).code === 'P2002';
}

/** Quita los datos personales: el destinatario se resuelve al entregar. */
function toStoredNotification(n: WebhookNotification): StoredNotification {
  return n.kind === 'payment-failed'
    ? { kind: 'payment-failed' }
    : {
        kind: 'receipt',
        amount: n.data.amount,
        currency: n.data.currency,
        invoiceUrl: n.data.invoiceUrl ?? null,
      };
}
