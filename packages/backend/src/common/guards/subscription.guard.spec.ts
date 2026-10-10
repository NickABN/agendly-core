import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { SubscriptionGuard } from './subscription.guard';

function ctxFor(tenantId?: string): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user: tenantId ? { tenantId } : undefined }),
    }),
  } as unknown as ExecutionContext;
}

function guardWith(tenant: unknown) {
  const prisma = {
    tenant: { findUnique: jest.fn().mockResolvedValue(tenant) },
  } as never;
  return new SubscriptionGuard(prisma);
}

const future = new Date(Date.now() + 5 * 86_400_000);
const past = new Date(Date.now() - 86_400_000);

describe('SubscriptionGuard (BILLING_ENFORCED=true)', () => {
  const original = process.env.BILLING_ENFORCED;
  beforeEach(() => {
    process.env.BILLING_ENFORCED = 'true';
  });
  afterEach(() => {
    process.env.BILLING_ENFORCED = original;
  });

  it('allows an active subscription', async () => {
    const guard = guardWith({
      isActive: true,
      subscriptionStatus: 'ACTIVE',
      trialEndsAt: past,
    });
    await expect(guard.canActivate(ctxFor('t1'))).resolves.toBe(true);
  });

  it('allows past_due (grace period)', async () => {
    const guard = guardWith({
      isActive: true,
      subscriptionStatus: 'PAST_DUE',
      trialEndsAt: past,
    });
    await expect(guard.canActivate(ctxFor('t1'))).resolves.toBe(true);
  });

  it('allows a valid trial', async () => {
    const guard = guardWith({
      isActive: true,
      subscriptionStatus: 'TRIALING',
      trialEndsAt: future,
    });
    await expect(guard.canActivate(ctxFor('t1'))).resolves.toBe(true);
  });

  it('blocks an expired trial without subscription', async () => {
    const guard = guardWith({
      isActive: true,
      subscriptionStatus: 'TRIALING',
      trialEndsAt: past,
    });
    await expect(guard.canActivate(ctxFor('t1'))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('blocks a canceled subscription', async () => {
    const guard = guardWith({
      isActive: true,
      subscriptionStatus: 'CANCELED',
      trialEndsAt: future,
    });
    await expect(guard.canActivate(ctxFor('t1'))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('blocks a deactivated tenant regardless of subscription', async () => {
    const guard = guardWith({
      isActive: false,
      subscriptionStatus: 'ACTIVE',
      trialEndsAt: future,
    });
    await expect(guard.canActivate(ctxFor('t1'))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('denies when there is no tenant in the request', async () => {
    const guard = guardWith(null);
    await expect(guard.canActivate(ctxFor(undefined))).resolves.toBe(false);
  });
});

describe('SubscriptionGuard (billing not enforced — free mode)', () => {
  const original = process.env.BILLING_ENFORCED;
  beforeEach(() => {
    delete process.env.BILLING_ENFORCED;
  });
  afterEach(() => {
    process.env.BILLING_ENFORCED = original;
  });

  it('allows an expired trial without subscription', async () => {
    const guard = guardWith({
      isActive: true,
      subscriptionStatus: 'TRIALING',
      trialEndsAt: past,
    });
    await expect(guard.canActivate(ctxFor('t1'))).resolves.toBe(true);
  });

  it('still blocks a deactivated tenant', async () => {
    const guard = guardWith({
      isActive: false,
      subscriptionStatus: 'TRIALING',
      trialEndsAt: future,
    });
    await expect(guard.canActivate(ctxFor('t1'))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
