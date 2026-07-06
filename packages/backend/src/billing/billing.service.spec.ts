import { BillingService } from './billing.service';
import type Stripe from 'stripe';

function makeConfig(overrides: Record<string, string> = {}) {
  return {
    get: (key: string, def?: string) => overrides[key] ?? def,
  } as never;
}

function makePrisma(tenant: unknown) {
  const update = jest.fn().mockResolvedValue({});
  return {
    prisma: {
      tenant: {
        findFirst: jest.fn().mockResolvedValue(tenant),
        update,
      },
    } as never,
    update,
  };
}

const email = {
  sendPaymentReceipt: jest.fn().mockResolvedValue(undefined),
  sendPaymentFailed: jest.fn().mockResolvedValue(undefined),
} as never;

describe('BillingService.handleEvent — mapeo de webhooks', () => {
  it('customer.subscription.updated (active) → ACTIVE + currentPeriodEnd', async () => {
    const { prisma, update } = makePrisma({ id: 't1', slug: 'salon' });
    const service = new BillingService(prisma, makeConfig(), email);

    const event = {
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: 'sub_1',
          customer: 'cus_1',
          status: 'active',
          items: { data: [{ current_period_end: 1893456000 }] },
        },
      },
    } as unknown as Stripe.Event;

    await service.handleEvent(event);

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 't1' },
        data: expect.objectContaining({
          stripeSubscriptionId: 'sub_1',
          subscriptionStatus: 'ACTIVE',
        }),
      }),
    );
  });

  it('customer.subscription.deleted → CANCELED', async () => {
    const { prisma, update } = makePrisma({ id: 't1', slug: 'salon' });
    const service = new BillingService(prisma, makeConfig(), email);

    const event = {
      type: 'customer.subscription.deleted',
      data: {
        object: {
          id: 'sub_1',
          customer: 'cus_1',
          status: 'canceled',
          items: { data: [{ current_period_end: 1893456000 }] },
        },
      },
    } as unknown as Stripe.Event;

    await service.handleEvent(event);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ subscriptionStatus: 'CANCELED' }),
      }),
    );
  });

  it('invoice.payment_failed → PAST_DUE + dunning', async () => {
    const { prisma, update } = makePrisma({
      id: 't1',
      name: 'Salón',
      users: [{ email: 'owner@x.com' }],
    });
    const service = new BillingService(prisma, makeConfig(), email);

    const event = {
      type: 'invoice.payment_failed',
      data: { object: { customer: 'cus_1' } },
    } as unknown as Stripe.Event;

    await service.handleEvent(event);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { subscriptionStatus: 'PAST_DUE' },
      }),
    );
  });

  it('ignora eventos sin tenant para el customer', async () => {
    const { prisma, update } = makePrisma(null);
    const service = new BillingService(prisma, makeConfig(), email);

    const event = {
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: 'sub_1',
          customer: 'cus_desconocido',
          status: 'active',
          items: { data: [] },
        },
      },
    } as unknown as Stripe.Event;

    await service.handleEvent(event);
    expect(update).not.toHaveBeenCalled();
  });
});
