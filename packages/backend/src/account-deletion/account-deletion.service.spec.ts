import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AccountDeletionService } from './account-deletion.service';

const NOW = new Date('2026-10-29T12:00:00.000Z');
const OWNER = { userId: 'u1', tenantId: 't1', role: 'OWNER' };

function build(
  opts: {
    tenant?: Record<string, unknown> | null;
    passwordHash?: string | null;
    cancelCount?: number;
    due?: Array<Record<string, unknown>>;
    deleteCount?: number;
  } = {},
) {
  const tenant =
    opts.tenant === undefined
      ? {
          id: 't1',
          name: 'Salón Calma',
          slug: 'salon-calma',
          timezone: 'America/Mexico_City',
          isActive: true,
          deletionScheduledAt: null,
          stripeSubscriptionId: null,
          subscriptionStatus: 'TRIALING',
        }
      : opts.tenant;
  const prisma = {
    tenant: {
      findUnique: jest.fn().mockResolvedValue(tenant),
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: opts.cancelCount ?? 1 }),
      findMany: jest.fn().mockResolvedValue(opts.due ?? []),
      deleteMany: jest.fn().mockResolvedValue({ count: opts.deleteCount ?? 1 }),
    },
    user: {
      findUnique: jest.fn().mockResolvedValue({
        passwordHash:
          opts.passwordHash === undefined ? null : opts.passwordHash,
      }),
      findMany: jest.fn().mockResolvedValue([{ email: 'owner@salon.mx' }]),
    },
    appointment: { count: jest.fn().mockResolvedValue(2) },
  };
  const email = {
    sendAccountDeletionScheduled: jest.fn().mockResolvedValue(undefined),
    sendAccountDeleted: jest.fn().mockResolvedValue(undefined),
  };
  const billing = {
    setCancelAtPeriodEnd: jest.fn().mockResolvedValue(undefined),
    cancelSubscriptionNow: jest.fn().mockResolvedValue(undefined),
  };
  const storage = { deletePrefix: jest.fn().mockResolvedValue(3) };
  const config = {
    get: (k: string) =>
      k === 'FRONTEND_URL' ? 'https://app.test/' : undefined,
  };
  const service = new AccountDeletionService(
    prisma as never,
    email as never,
    billing as never,
    storage as never,
    config as never,
  );
  return { service, prisma, email, billing, storage };
}

const flush = () => new Promise((r) => setImmediate(r));

describe('AccountDeletionService.requestDeletion', () => {
  it('deactivates the tenant, schedules the purge in 30 days and emails the owner', async () => {
    const { service, prisma, email } = build();

    await service.requestDeletion(OWNER, ' Salon-Calma ', undefined, NOW);

    expect(prisma.tenant.update).toHaveBeenCalledWith({
      where: { id: 't1' },
      data: {
        isActive: false,
        deletionScheduledAt: new Date('2026-11-28T12:00:00.000Z'),
      },
    });
    await flush();
    expect(email.sendAccountDeletionScheduled).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'owner@salon.mx',
        loginUrl: 'https://app.test/login',
        deletionDate: expect.stringContaining('noviembre'),
      }),
    );
  });

  it('requires the owner password when one is set', async () => {
    const passwordHash = await bcrypt.hash('secreta123', 4);

    await expect(
      build({ passwordHash }).service.requestDeletion(
        OWNER,
        'salon-calma',
        'mala',
        NOW,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      build({ passwordHash }).service.requestDeletion(
        OWNER,
        'salon-calma',
        undefined,
        NOW,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    const ok = build({ passwordHash });
    await ok.service.requestDeletion(OWNER, 'salon-calma', 'secreta123', NOW);
    expect(ok.prisma.tenant.update).toHaveBeenCalled();
  });

  it('rejects a wrong confirmation, non-owners, and double requests', async () => {
    const wrong = build();
    await expect(
      wrong.service.requestDeletion(OWNER, 'otro-salon', undefined, NOW),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(wrong.prisma.tenant.update).not.toHaveBeenCalled();

    await expect(
      build().service.requestDeletion(
        { ...OWNER, role: 'ADMIN' },
        'salon-calma',
        undefined,
        NOW,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    await expect(
      build({
        tenant: {
          id: 't1',
          slug: 'salon-calma',
          isActive: false,
          deletionScheduledAt: NOW,
        },
      }).service.requestDeletion(OWNER, 'salon-calma', undefined, NOW),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('does not schedule a tenant deactivated for another reason', async () => {
    await expect(
      build({
        tenant: {
          id: 't1',
          slug: 'salon-calma',
          isActive: false,
          deletionScheduledAt: null,
        },
      }).service.requestDeletion(OWNER, 'salon-calma', undefined, NOW),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('stops Stripe renewal for a live subscription', async () => {
    const { service, billing } = build({
      tenant: {
        id: 't1',
        name: 'Salón',
        slug: 'salon-calma',
        timezone: 'America/Mexico_City',
        isActive: true,
        deletionScheduledAt: null,
        stripeSubscriptionId: 'sub_1',
        subscriptionStatus: 'ACTIVE',
      },
    });

    await service.requestDeletion(OWNER, 'salon-calma', undefined, NOW);

    expect(billing.setCancelAtPeriodEnd).toHaveBeenCalledWith('sub_1', true);
  });
});

describe('AccountDeletionService.cancelDeletion', () => {
  it('reactivates only a tenant with a pending deletion', async () => {
    const { service, prisma } = build();

    await service.cancelDeletion(OWNER, NOW);

    expect(prisma.tenant.updateMany).toHaveBeenCalledWith({
      where: { id: 't1', deletionScheduledAt: { not: null } },
      data: { isActive: true, deletionScheduledAt: null },
    });
  });

  it('fails when nothing is pending', async () => {
    await expect(
      build({ cancelCount: 0 }).service.cancelDeletion(OWNER, NOW),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('AccountDeletionService.purgeDue', () => {
  it('deletes due tenants atomically, then cleans R2 and Stripe and emails the owner', async () => {
    const { service, prisma, storage, billing, email } = build({
      due: [{ id: 't1', name: 'Salón', stripeSubscriptionId: 'sub_1' }],
    });

    const res = await service.purgeDue(NOW);

    expect(res).toEqual({ due: 1, purged: 1, failed: 0 });
    expect(prisma.tenant.deleteMany).toHaveBeenCalledWith({
      where: { id: 't1', deletionScheduledAt: { lte: NOW } },
    });
    expect(storage.deletePrefix).toHaveBeenCalledWith('tenants/t1/');
    expect(billing.cancelSubscriptionNow).toHaveBeenCalledWith('sub_1');
    expect(email.sendAccountDeleted).toHaveBeenCalledWith({
      to: 'owner@salon.mx',
      businessName: 'Salón',
    });
  });

  it('keeps a tenant reactivated between the read and the delete', async () => {
    const { service, storage, email } = build({
      due: [{ id: 't1', name: 'Salón', stripeSubscriptionId: null }],
      deleteCount: 0,
    });

    const res = await service.purgeDue(NOW);

    expect(res).toEqual({ due: 1, purged: 0, failed: 0 });
    expect(storage.deletePrefix).not.toHaveBeenCalled();
    expect(email.sendAccountDeleted).not.toHaveBeenCalled();
  });

  it('still counts the purge when external cleanup fails', async () => {
    const { service, storage } = build({
      due: [{ id: 't1', name: 'Salón', stripeSubscriptionId: null }],
    });
    storage.deletePrefix.mockRejectedValue(new Error('R2 down'));

    expect(await service.purgeDue(NOW)).toEqual({
      due: 1,
      purged: 1,
      failed: 0,
    });
  });
});
