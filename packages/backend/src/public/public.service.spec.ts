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

function directoryTenant(overrides: Record<string, unknown> = {}) {
  return {
    id: 'tenant-1',
    name: 'Salón Calma',
    slug: 'salon-calma',
    logoUrl: 'https://cdn.example/logo.webp',
    address: 'Av. Reforma 1, Ciudad de México',
    phone: '+52 55 1234 5678',
    email: 'owner@example.com',
    latitude: 19.4326,
    longitude: -99.1332,
    listedInDirectory: true,
    onboardedAt: new Date('2026-01-01T00:00:00.000Z'),
    deletionScheduledAt: null,
    isActive: true,
    subscriptionStatus: 'ACTIVE',
    trialEndsAt: new Date('2099-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

type DirectoryQuery = {
  where?: Record<string, unknown>;
  orderBy?: { name?: 'asc' | 'desc' };
  take?: number;
};

function directoryServiceWith(rows: Record<string, unknown>[]) {
  const findMany = jest
    .fn()
    .mockImplementation(async (query: DirectoryQuery = {}) => {
      const where = query.where ?? {};
      let results = rows.filter((row) => {
        if (
          'listedInDirectory' in where &&
          row.listedInDirectory !== where.listedInDirectory
        ) {
          return false;
        }
        if (
          typeof where.onboardedAt === 'object' &&
          where.onboardedAt !== null &&
          'not' in where.onboardedAt &&
          where.onboardedAt.not === null &&
          row.onboardedAt === null
        ) {
          return false;
        }
        if (
          'deletionScheduledAt' in where &&
          where.deletionScheduledAt === null &&
          row.deletionScheduledAt !== null
        ) {
          return false;
        }
        if (where.isActive === true && row.isActive !== true) return false;

        if (Array.isArray(where.OR)) {
          const matches = where.OR.some((condition) => {
            if (typeof condition !== 'object' || condition === null) {
              return false;
            }
            return Object.entries(condition).some(([field, filter]) => {
              if (
                typeof filter !== 'object' ||
                filter === null ||
                !('contains' in filter)
              ) {
                return false;
              }
              const needle = String(filter.contains).toLocaleLowerCase();
              const value = row[field];
              return (typeof value === 'string' ? value : '')
                .toLocaleLowerCase()
                .includes(needle);
            });
          });
          if (!matches) return false;
        }

        return true;
      });

      if (query.orderBy?.name === 'asc') {
        results = results.sort((left, right) =>
          String(left.name).localeCompare(String(right.name)),
        );
      }
      if (query.orderBy?.name === 'desc') {
        results = results.sort((left, right) =>
          String(right.name).localeCompare(String(left.name)),
        );
      }
      if (query.take !== undefined) results = results.slice(0, query.take);
      return results;
    });
  const prisma = {
    tenant: { findUnique: jest.fn(), findMany },
    service: { findMany: jest.fn().mockResolvedValue([]) },
    employee: { findMany: jest.fn().mockResolvedValue([]) },
  } as never;
  return { service: new PublicService(prisma), findMany };
}

function getDirectory(service: PublicService, q?: string) {
  const directoryService = service as unknown as {
    getDirectory: (query?: string) => Promise<{
      businesses: Array<{
        name: string;
        slug: string;
        logoUrl: string | null;
        address: string | null;
      }>;
    }>;
  };
  return directoryService.getDirectory(q);
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

describe('PublicService.getDirectory', () => {
  const original = process.env.BILLING_ENFORCED;

  afterEach(() => {
    process.env.BILLING_ENFORCED = original;
  });

  it('excludes unlisted, incomplete, scheduled-for-deletion, and inaccessible tenants', async () => {
    process.env.BILLING_ENFORCED = 'true';
    const { service } = directoryServiceWith([
      directoryTenant(),
      directoryTenant({ id: 'unlisted', listedInDirectory: false }),
      directoryTenant({ id: 'not-onboarded', onboardedAt: null }),
      directoryTenant({ id: 'deleting', deletionScheduledAt: new Date() }),
      directoryTenant({ id: 'inactive', isActive: false }),
      directoryTenant({
        id: 'expired-trial',
        subscriptionStatus: 'TRIALING',
        trialEndsAt: new Date('2000-01-01T00:00:00.000Z'),
      }),
    ]);

    const result = await getDirectory(service);

    expect(result.businesses.map((business) => business.slug)).toEqual([
      'salon-calma',
    ]);
  });

  it('matches name or address case-insensitively after trimming q', async () => {
    const { service } = directoryServiceWith([
      directoryTenant({
        id: 'name-match',
        name: 'Luna Beauty',
        slug: 'luna-beauty',
      }),
      directoryTenant({
        id: 'address-match',
        name: 'Estudio Sol',
        slug: 'estudio-sol',
        address: 'Zona LUNA, Guadalajara',
      }),
      directoryTenant({
        id: 'not-match',
        name: 'Estudio Nube',
        slug: 'estudio-nube',
      }),
    ]);

    const result = await getDirectory(service, '  LuNa  ');

    expect(result.businesses.map((business) => business.slug)).toEqual([
      'estudio-sol',
      'luna-beauty',
    ]);
  });

  it('orders businesses by name and returns no more than 50', async () => {
    const rows = Array.from({ length: 55 }, (_, index) => {
      const number = 55 - index;
      return directoryTenant({
        id: `tenant-${number}`,
        name: `Negocio ${String(number).padStart(2, '0')}`,
        slug: `negocio-${String(number).padStart(2, '0')}`,
      });
    });
    const { service } = directoryServiceWith(rows);

    const result = await getDirectory(service);

    expect(result.businesses).toHaveLength(50);
    expect(result.businesses.map((business) => business.name)).toEqual(
      Array.from(
        { length: 50 },
        (_, index) => `Negocio ${String(index + 1).padStart(2, '0')}`,
      ),
    );
  });

  it('exposes only the four public directory fields', async () => {
    const { service } = directoryServiceWith([
      directoryTenant({ logoUrl: null, address: null }),
    ]);

    const result = await getDirectory(service);

    expect(result.businesses[0]).toEqual({
      name: 'Salón Calma',
      slug: 'salon-calma',
      logoUrl: null,
      address: null,
    });
    expect(Object.keys(result.businesses[0]).sort()).toEqual([
      'address',
      'logoUrl',
      'name',
      'slug',
    ]);
  });
});
