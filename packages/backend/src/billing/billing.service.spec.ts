import { BillingService } from './billing.service';
import type Stripe from 'stripe';
import { ConflictException } from '@nestjs/common';
import type { EmailService } from '../email/email.service';

function makeConfig(overrides: Record<string, string> = {}) {
  return {
    get: (key: string, def?: string) => overrides[key] ?? def,
  } as never;
}

function makePrisma(tenant: unknown) {
  const findFirst = jest.fn().mockResolvedValue(tenant);
  const update = jest.fn().mockResolvedValue({});
  const create = jest.fn().mockResolvedValue({});
  const findUnique = jest.fn();
  const updateMany = jest.fn().mockResolvedValue({ count: 1 });
  const eventUpdate = jest.fn().mockResolvedValue({});
  const deleteMany = jest.fn().mockResolvedValue({ count: 1 });
  const tenantDelegate = { findFirst, update };
  const eventDelegate = {
    create,
    findUnique,
    updateMany,
    update: eventUpdate,
    deleteMany,
  };
  const transaction = jest.fn(async (callback) =>
    callback({
      tenant: tenantDelegate,
      stripeWebhookEvent: eventDelegate,
    }),
  );
  return {
    prisma: {
      tenant: tenantDelegate,
      stripeWebhookEvent: eventDelegate,
      $transaction: transaction,
    } as never,
    update,
    create,
    findUnique,
    updateMany,
    eventUpdate,
    deleteMany,
    transaction,
  };
}

const email = {
  sendPaymentReceipt: jest.fn().mockResolvedValue(undefined),
  sendPaymentFailed: jest.fn().mockResolvedValue(undefined),
} as unknown as EmailService;

const FUTURE_LEASE = new Date('2099-01-01T00:00:00.000Z');
const EXPIRED_LEASE = new Date('2000-01-01T00:00:00.000Z');

function subscriptionEvent(
  id: string,
  type: Stripe.Event['type'] = 'customer.subscription.updated',
  status: string = 'active',
) {
  return {
    id,
    type,
    data: {
      object: { id: 'sub_1', customer: 'cus_1', status, items: { data: [] } },
    },
  } as unknown as Stripe.Event;
}

function invoiceEvent(
  id: string,
  type: Stripe.Event['type'] = 'invoice.paid',
  object: Record<string, unknown> = { customer: 'cus_1' },
) {
  return { id, type, data: { object } } as unknown as Stripe.Event;
}

describe('BillingService.handleEvent — mapeo de webhooks', () => {
  it('customer.subscription.updated (active) → ACTIVE + currentPeriodEnd', async () => {
    const { prisma, update, updateMany } = makePrisma({
      id: 't1',
      slug: 'salon',
    });
    const service = new BillingService(prisma, makeConfig(), email);

    const event = subscriptionEvent('evt_subscription_updated');

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
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          eventId: 'evt_subscription_updated',
          claimToken: expect.any(String),
          status: 'PROCESSING',
        }),
        data: { tenantId: 't1' },
      }),
    );
  });

  it('customer.subscription.deleted → CANCELED', async () => {
    const { prisma, update } = makePrisma({ id: 't1', slug: 'salon' });
    const service = new BillingService(prisma, makeConfig(), email);

    const event = subscriptionEvent(
      'evt_subscription_deleted',
      'customer.subscription.deleted',
      'canceled',
    );

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

    const event = invoiceEvent('evt_payment_failed', 'invoice.payment_failed');

    await service.handleEvent(event);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { subscriptionStatus: 'PAST_DUE' },
      }),
    );
  });

  it('sends notification only after the atomic transaction commits', async () => {
    email.sendPaymentReceipt.mockClear();
    const { prisma, transaction } = makePrisma({
      id: 't1',
      name: 'Salón',
      users: [{ email: 'owner@x.com' }],
    });
    let commit!: () => void;
    const commitGate = new Promise<void>((resolve) => {
      commit = resolve;
    });
    transaction.mockImplementationOnce(async (callback) => {
      const result = await callback({
        tenant: prisma.tenant,
        stripeWebhookEvent: prisma.stripeWebhookEvent,
      });
      await commitGate;
      return result;
    });
    const service = new BillingService(prisma, makeConfig(), email);
    const event = invoiceEvent('evt_receipt_commit', 'invoice.paid', {
      customer: 'cus_1',
      amount_paid: 1000,
      currency: 'mxn',
    });

    const handling = service.handleEvent(event);
    await Promise.resolve();
    expect(email.sendPaymentReceipt).not.toHaveBeenCalled();
    commit();
    await handling;

    expect(transaction).toHaveBeenCalledTimes(1);
    expect(email.sendPaymentReceipt).toHaveBeenCalledTimes(1);
  });

  it('keeps tenant update and completion inside the transaction on failure', async () => {
    let rolledBack = false;
    const { prisma, transaction, updateMany, update } = makePrisma({
      id: 't1',
      slug: 'salon',
    });
    transaction.mockImplementationOnce(async (callback) => {
      try {
        return await callback({
          tenant: prisma.tenant,
          stripeWebhookEvent: prisma.stripeWebhookEvent,
        });
      } catch (error) {
        rolledBack = true;
        throw error;
      }
    });
    updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockRejectedValueOnce(new Error('commit failed'));
    const service = new BillingService(prisma, makeConfig(), email);
    const event = subscriptionEvent('evt_atomic_failure');

    await expect(service.handleEvent(event)).rejects.toThrow('commit failed');

    expect(transaction).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalled();
    expect(rolledBack).toBe(true);
  });

  it('ignora eventos sin tenant para el customer', async () => {
    const { prisma, update } = makePrisma(null);
    const service = new BillingService(prisma, makeConfig(), email);

    const event = subscriptionEvent('evt_unknown_customer');

    await service.handleEvent(event);
    expect(update).not.toHaveBeenCalled();
  });

  it('completed duplicate returns without repeating side effects', async () => {
    const { prisma, create, findUnique, update } = makePrisma({
      id: 't1',
      slug: 'salon',
    });
    create.mockRejectedValueOnce({ code: 'P2002' });
    findUnique.mockResolvedValue({ status: 'COMPLETED' });
    const service = new BillingService(prisma, makeConfig(), email);
    const event = subscriptionEvent('evt_duplicate');

    await service.handleEvent(event);

    expect(update).not.toHaveBeenCalled();
  });

  it('in-progress duplicate is retryable and does not dispatch', async () => {
    const { prisma, create, findUnique, update } = makePrisma({
      id: 't1',
      slug: 'salon',
    });
    create.mockRejectedValueOnce({ code: 'P2002' });
    findUnique.mockResolvedValue({
      status: 'PROCESSING',
      leaseExpiresAt: FUTURE_LEASE,
    });
    const service = new BillingService(prisma, makeConfig(), email);
    const event = subscriptionEvent('evt_in_progress');

    await expect(service.handleEvent(event)).rejects.toBeInstanceOf(
      ConflictException,
    );

    expect(update).not.toHaveBeenCalled();
  });

  it('concurrent unique conflict remains retryable while the owner processes', async () => {
    const { prisma, create, findUnique, update } = makePrisma({
      id: 't1',
      slug: 'salon',
    });
    let releaseFirst: (() => void) | undefined;
    const firstProcessing = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    create.mockImplementationOnce(async () => {
      await firstProcessing;
      return {};
    });
    create.mockRejectedValueOnce({ code: 'P2002' });
    findUnique.mockResolvedValue({
      status: 'PROCESSING',
      leaseExpiresAt: FUTURE_LEASE,
    });
    const service = new BillingService(prisma, makeConfig(), email);
    const event = subscriptionEvent('evt_concurrent');

    const first = service.handleEvent(event);
    const duplicate = service.handleEvent(event);
    await expect(duplicate).rejects.toBeInstanceOf(ConflictException);
    releaseFirst!();
    await first;

    expect(update).toHaveBeenCalledTimes(1);
  });

  it('deletes a failed claim so the same event can retry', async () => {
    const { prisma, create, deleteMany } = makePrisma({
      id: 't1',
      slug: 'salon',
    });
    const service = new BillingService(prisma, makeConfig(), email);
    const event = subscriptionEvent('evt_retry');
    const processingError = new Error('database unavailable');
    prisma.tenant.findFirst.mockRejectedValueOnce(processingError);

    await expect(service.handleEvent(event)).rejects.toBe(processingError);

    expect(deleteMany).toHaveBeenCalledWith({
      where: { eventId: 'evt_retry', claimToken: expect.any(String) },
    });
    expect(create).toHaveBeenCalledTimes(1);

    await service.handleEvent(event);

    expect(create).toHaveBeenCalledTimes(2);
  });

  it('takes over a stale claim and processes the event', async () => {
    const { prisma, create, findUnique, updateMany, update } = makePrisma({
      id: 't1',
      slug: 'salon',
    });
    create.mockRejectedValueOnce({ code: 'P2002' });
    findUnique.mockResolvedValue({
      status: 'PROCESSING',
      leaseExpiresAt: EXPIRED_LEASE,
    });
    const service = new BillingService(prisma, makeConfig(), email);
    const event = subscriptionEvent('evt_stale');

    await service.handleEvent(event);

    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          eventId: 'evt_stale',
          status: 'PROCESSING',
          leaseExpiresAt: expect.objectContaining({ lt: expect.any(Date) }),
        }),
      }),
    );
    expect(update).toHaveBeenCalled();
  });

  it('does not take over when another worker wins the stale-claim race', async () => {
    const { prisma, create, findUnique, updateMany, update } = makePrisma({
      id: 't1',
      slug: 'salon',
    });
    create.mockRejectedValueOnce({ code: 'P2002' });
    findUnique
      .mockResolvedValueOnce({
        status: 'PROCESSING',
        leaseExpiresAt: EXPIRED_LEASE,
      })
      .mockResolvedValueOnce({
        status: 'PROCESSING',
        leaseExpiresAt: FUTURE_LEASE,
      });
    updateMany.mockResolvedValueOnce({ count: 0 });
    const service = new BillingService(prisma, makeConfig(), email);
    const event = subscriptionEvent('evt_takeover_race');

    await expect(service.handleEvent(event)).rejects.toBeInstanceOf(
      ConflictException,
    );

    expect(update).not.toHaveBeenCalled();
  });
});
