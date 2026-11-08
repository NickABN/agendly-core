import { NotFoundException } from '@nestjs/common';
import { PublicService } from './public.service';

const tenant = {
  id: 't1',
  name: 'Bellas Nails',
  slug: 'bellas-nails',
  timezone: 'America/Mexico_City',
  logoUrl: 'https://cdn.example/logo.webp',
  bannerUrl: null,
  address: 'Av. Chapultepec 123, Guadalajara',
  phone: '+52 33 1234 5678',
  isActive: true,
  subscriptionStatus: 'TRIALING',
  trialEndsAt: new Date(Date.now() - 86_400_000), // expired trial
};

function serviceWith(found: unknown) {
  const prisma = {
    tenant: { findUnique: jest.fn().mockResolvedValue(found) },
    service: { findMany: jest.fn().mockResolvedValue([]) },
    employee: { findMany: jest.fn().mockResolvedValue([]) },
  } as never;
  return new PublicService(prisma);
}

describe('PublicService.getTenantBySlug', () => {
  const original = process.env.BILLING_ENFORCED;
  afterEach(() => {
    process.env.BILLING_ENFORCED = original;
  });

  it('exposes the branding and contact the owner configured', async () => {
    delete process.env.BILLING_ENFORCED;
    const res = await serviceWith(tenant).getTenantBySlug('bellas-nails');
    expect(res.tenant).toEqual({
      name: 'Bellas Nails',
      slug: 'bellas-nails',
      timezone: 'America/Mexico_City',
      logoUrl: 'https://cdn.example/logo.webp',
      bannerUrl: null,
      address: 'Av. Chapultepec 123, Guadalajara',
      phone: '+52 33 1234 5678',
    });
  });

  it('exposes saved map coordinates as numbers and null when the business has none', async () => {
    delete process.env.BILLING_ENFORCED;
    const withCoordinates = await serviceWith({
      ...tenant,
      latitude: 19.4326,
      longitude: -99.1332,
    }).getTenantBySlug('bellas-nails');
    const withoutCoordinates = await serviceWith({
      ...tenant,
      latitude: null,
      longitude: null,
    }).getTenantBySlug('bellas-nails');

    expect(withCoordinates.tenant).toHaveProperty('latitude', 19.4326);
    expect(withCoordinates.tenant).toHaveProperty('longitude', -99.1332);
    expect(withoutCoordinates.tenant).toHaveProperty('latitude', null);
    expect(withoutCoordinates.tenant).toHaveProperty('longitude', null);
  });

  it('keeps serving an expired trial while billing is not enforced', async () => {
    delete process.env.BILLING_ENFORCED;
    await expect(
      serviceWith(tenant).getTenantBySlug('bellas-nails'),
    ).resolves.toBeDefined();
  });

  it('hides an expired trial once billing is enforced', async () => {
    process.env.BILLING_ENFORCED = 'true';
    await expect(
      serviceWith(tenant).getTenantBySlug('bellas-nails'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
