import { BadRequestException, ConflictException } from '@nestjs/common';
import { TenantService } from './tenant.service';

const TENANT_ID = 'tenant-1';

const baseTenant = {
  id: TENANT_ID,
  name: 'Salón Calma',
  slug: 'salon-calma',
  phone: null,
  address: null,
  logoUrl: null,
  bannerUrl: null,
  latitude: null,
  longitude: null,
  timezone: 'America/Mexico_City',
  onboardedAt: null,
  trialEndsAt: new Date('2026-08-01T00:00:00.000Z'),
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

/** Minimal Prisma mock: no slug collisions by default, update echoes the data. */
function makePrisma() {
  return {
    tenant: {
      findUnique: jest.fn().mockResolvedValue(null),
      update: jest
        .fn()
        .mockImplementation(({ data }: { data: Record<string, unknown> }) =>
          Promise.resolve({ ...baseTenant, ...data }),
        ),
    },
  };
}

describe('TenantService.update — slug validation', () => {
  it.each(['admin', 'onboarding', 'login', 'api'])(
    'rejects the reserved slug "%s" without touching the database',
    async (slug) => {
      const prisma = makePrisma();
      const service = new TenantService(prisma as never);

      await expect(service.update(TENANT_ID, { slug })).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.tenant.update).not.toHaveBeenCalled();
    },
  );

  it('rejects a slug already used by another tenant', async () => {
    const prisma = makePrisma();
    prisma.tenant.findUnique.mockResolvedValue({
      ...baseTenant,
      id: 'other-tenant',
      slug: 'taken-slug',
    });
    const service = new TenantService(prisma as never);

    await expect(
      service.update(TENANT_ID, { slug: 'taken-slug' }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.tenant.update).not.toHaveBeenCalled();
  });

  it('accepts an available non-reserved slug', async () => {
    const prisma = makePrisma();
    const service = new TenantService(prisma as never);

    const result = await service.update(TENANT_ID, { slug: 'mi-salon' });

    expect(result.slug).toBe('mi-salon');
    expect(prisma.tenant.update).toHaveBeenCalledWith({
      where: { id: TENANT_ID },
      data: { slug: 'mi-salon' },
    });
  });
});
