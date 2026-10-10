import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useAuthStore } from './auth';

const user = { id: 'u1', email: 'a@b.mx', name: 'Ana', role: 'OWNER', tenantId: 't1' };
const expiredTrial = {
  id: 't1',
  name: 'Salón',
  slug: 'salon',
  onboardedAt: '2026-01-01T00:00:00.000Z',
  trialEndsAt: '2026-01-15T00:00:00.000Z',
  isActive: true,
  subscriptionStatus: 'TRIALING' as const,
};

describe('auth store — access while Agendly is free', () => {
  beforeEach(() => setActivePinia(createPinia()));

  it('trusts the server: an expired trial keeps access when billing is not enforced', () => {
    const store = useAuthStore();
    store.setAuth(user, { ...expiredTrial, billingEnforced: false, hasAccess: true });
    expect(store.hasAccess).toBe(true);
    expect(store.billingEnforced).toBe(false);
  });

  it('honors a server-side denial when billing is enforced', () => {
    const store = useAuthStore();
    store.setAuth(user, { ...expiredTrial, billingEnforced: true, hasAccess: false });
    expect(store.hasAccess).toBe(false);
    expect(store.billingEnforced).toBe(true);
  });

  it('falls back to the local trial rule for legacy payloads without hasAccess', () => {
    const store = useAuthStore();
    store.setAuth(user, expiredTrial);
    expect(store.hasAccess).toBe(false);
  });
});
