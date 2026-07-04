import { UnprocessableEntityException } from '@nestjs/common';
import { validate } from 'class-validator';
import * as fc from 'fast-check';
import { ProfileService } from './profile.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateLocationDto } from './dto/update-location.dto';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTenantRecord(
  overrides: Partial<{
    id: string;
    name: string;
    slug: string;
    phone: string | null;
    address: string | null;
    logoUrl: string | null;
    bannerUrl: string | null;
    latitude: number | null;
    longitude: number | null;
    timezone: string;
    onboardedAt: Date | null;
    trialEndsAt: Date;
    isActive: boolean;
  }> = {},
) {
  return {
    id: 'tenant-123',
    name: 'Mi Negocio',
    slug: 'mi-negocio',
    phone: '+521234567890',
    address: 'Calle Falsa 123, CDMX',
    logoUrl: 'https://cdn.example.com/logo.jpg',
    bannerUrl: 'https://cdn.example.com/banner.jpg',
    latitude: 19.4326,
    longitude: -99.1332,
    timezone: 'America/Mexico_City',
    onboardedAt: new Date('2024-01-01T00:00:00Z'),
    trialEndsAt: new Date('2024-12-31T00:00:00Z'),
    isActive: true,
    ...overrides,
  };
}

function makeImageVersionRecord(
  overrides: Partial<{
    id: string;
    tenantId: string;
    url: string;
    fileSize: number;
    imageType: string;
    createdAt: Date;
  }> = {},
) {
  return {
    id: 'img-v-1',
    tenantId: 'tenant-123',
    url: 'https://cdn.example.com/logo.jpg',
    fileSize: 1024,
    imageType: 'LOGO',
    createdAt: new Date('2024-06-01T00:00:00Z'),
    ...overrides,
  };
}

function makePrisma(
  overrides: {
    tenantFindUniqueOrThrow?: jest.Mock;
    tenantUpdate?: jest.Mock;
    imageVersionFindMany?: jest.Mock;
  } = {},
) {
  const tenant = makeTenantRecord();
  return {
    tenant: {
      findUniqueOrThrow:
        overrides.tenantFindUniqueOrThrow ??
        jest.fn().mockResolvedValue(tenant),
      update: overrides.tenantUpdate ?? jest.fn().mockResolvedValue(tenant),
    },
    imageVersion: {
      findMany:
        overrides.imageVersionFindMany ?? jest.fn().mockResolvedValue([]),
    },
  } as any;
}

function makeGeocoder(
  geocodeImpl?: () => Promise<{ latitude: number; longitude: number } | null>,
) {
  return {
    geocode: jest
      .fn()
      .mockImplementation(
        geocodeImpl ??
          (() => Promise.resolve({ latitude: 19.4326, longitude: -99.1332 })),
      ),
  } as any;
}

function makeService(
  prismaOverride?: ReturnType<typeof makePrisma>,
  geocoderOverride?: ReturnType<typeof makeGeocoder>,
) {
  const prisma = prismaOverride ?? makePrisma();
  const geocoder = geocoderOverride ?? makeGeocoder();
  const service = new ProfileService(prisma, geocoder);
  return { service, prisma, geocoder };
}

// ---------------------------------------------------------------------------
// 8.1 — Unit tests for ProfileService
// ---------------------------------------------------------------------------

describe('ProfileService — unit tests', () => {
  describe('getProfile', () => {
    it('returns all required fields for a seeded tenant', async () => {
      const tenant = makeTenantRecord();
      const prisma = makePrisma({
        tenantFindUniqueOrThrow: jest.fn().mockResolvedValue(tenant),
      });
      const { service } = makeService(prisma);

      const result = await service.getProfile('tenant-123');

      expect(result.id).toBe(tenant.id);
      expect(result.name).toBe(tenant.name);
      expect(result.slug).toBe(tenant.slug);
      expect(result.phone).toBe(tenant.phone);
      expect(result.address).toBe(tenant.address);
      expect(result.logoUrl).toBe(tenant.logoUrl);
      expect(result.bannerUrl).toBe(tenant.bannerUrl);
      expect(result.latitude).toBe(tenant.latitude);
      expect(result.longitude).toBe(tenant.longitude);
      expect(result.timezone).toBe(tenant.timezone);
      expect(result.onboardedAt).toBe(tenant.onboardedAt!.toISOString());
      expect(result.trialEndsAt).toBe(tenant.trialEndsAt.toISOString());
      expect(result.isActive).toBe(tenant.isActive);
    });

    it('returns null for logoUrl and bannerUrl when not set', async () => {
      const tenant = makeTenantRecord({ logoUrl: null, bannerUrl: null });
      const prisma = makePrisma({
        tenantFindUniqueOrThrow: jest.fn().mockResolvedValue(tenant),
      });
      const { service } = makeService(prisma);

      const result = await service.getProfile('tenant-123');

      expect(result.logoUrl).toBeNull();
      expect(result.bannerUrl).toBeNull();
    });
  });

  describe('updateProfile', () => {
    it('PATCH with only name updates name and leaves phone/timezone unchanged', async () => {
      const original = makeTenantRecord({
        name: 'Nombre Original',
        phone: '+521234567890',
        timezone: 'America/Mexico_City',
      });
      const updated = { ...original, name: 'Nuevo Nombre' };

      const tenantUpdate = jest.fn().mockResolvedValue(updated);
      const prisma = makePrisma({ tenantUpdate });
      const { service } = makeService(prisma);

      const dto = new UpdateProfileDto();
      dto.name = 'Nuevo Nombre';

      const result = await service.updateProfile('tenant-123', dto);

      // Only name was passed to prisma.update
      expect(tenantUpdate).toHaveBeenCalledWith({
        where: { id: 'tenant-123' },
        data: { name: 'Nuevo Nombre' },
      });
      expect(result.name).toBe('Nuevo Nombre');
      expect(result.phone).toBe(original.phone);
      expect(result.timezone).toBe(original.timezone);
    });

    it('PATCH with invalid name length — service passes data through (validation is DTO layer)', async () => {
      // The service itself does not validate — class-validator on the DTO does.
      // Here we verify the service calls prisma.update with whatever is passed.
      const tenantUpdate = jest
        .fn()
        .mockResolvedValue(makeTenantRecord({ name: 'X' }));
      const prisma = makePrisma({ tenantUpdate });
      const { service } = makeService(prisma);

      const dto = new UpdateProfileDto();
      dto.name = 'X'; // too short — would be rejected by class-validator in the controller pipeline

      await service.updateProfile('tenant-123', dto);

      expect(tenantUpdate).toHaveBeenCalledWith({
        where: { id: 'tenant-123' },
        data: { name: 'X' },
      });
    });
  });

  describe('updateLocation', () => {
    it('stores explicit valid coordinates directly without calling geocoder', async () => {
      const tenantUpdate = jest.fn().mockResolvedValue(
        makeTenantRecord({
          address: 'Calle 1',
          latitude: 20.0,
          longitude: -100.0,
        }),
      );
      const prisma = makePrisma({ tenantUpdate });
      const geocoder = makeGeocoder();
      const { service } = makeService(prisma, geocoder);

      const dto = new UpdateLocationDto();
      dto.address = 'Calle 1';
      dto.latitude = 20.0;
      dto.longitude = -100.0;

      const result = await service.updateLocation('tenant-123', dto);

      expect(geocoder.geocode).not.toHaveBeenCalled();
      expect(tenantUpdate).toHaveBeenCalledWith({
        where: { id: 'tenant-123' },
        data: { address: 'Calle 1', latitude: 20.0, longitude: -100.0 },
      });
      expect(result.latitude).toBe(20.0);
      expect(result.longitude).toBe(-100.0);
      expect(result.geocodingWarning).toBeUndefined();
    });

    it('calls geocoder when no explicit coordinates are provided', async () => {
      const geocoder = makeGeocoder(() =>
        Promise.resolve({ latitude: 19.4326, longitude: -99.1332 }),
      );
      const tenantUpdate = jest.fn().mockResolvedValue(makeTenantRecord());
      const prisma = makePrisma({ tenantUpdate });
      const { service } = makeService(prisma, geocoder);

      const dto = new UpdateLocationDto();
      dto.address = 'Paseo de la Reforma, CDMX';

      const result = await service.updateLocation('tenant-123', dto);

      expect(geocoder.geocode).toHaveBeenCalledWith(
        'Paseo de la Reforma, CDMX',
      );
      expect(result.latitude).toBe(19.4326);
      expect(result.longitude).toBe(-99.1332);
      expect(result.geocodingWarning).toBeUndefined();
    });

    it('stores address with null coordinates and geocodingWarning when geocoder returns null', async () => {
      const geocoder = makeGeocoder(() => Promise.resolve(null));
      const tenantUpdate = jest
        .fn()
        .mockResolvedValue(
          makeTenantRecord({ latitude: null, longitude: null }),
        );
      const prisma = makePrisma({ tenantUpdate });
      const { service } = makeService(prisma, geocoder);

      const dto = new UpdateLocationDto();
      dto.address = 'Dirección desconocida 999';

      const result = await service.updateLocation('tenant-123', dto);

      expect(tenantUpdate).toHaveBeenCalledWith({
        where: { id: 'tenant-123' },
        data: {
          address: 'Dirección desconocida 999',
          latitude: null,
          longitude: null,
        },
      });
      expect(result.latitude).toBeNull();
      expect(result.longitude).toBeNull();
      expect(result.geocodingWarning).toBeDefined();
    });

    it('throws UnprocessableEntityException for latitude out of range', async () => {
      const { service } = makeService();

      const dto = new UpdateLocationDto();
      dto.address = 'Alguna dirección';
      dto.latitude = 91;
      dto.longitude = 0;

      await expect(
        service.updateLocation('tenant-123', dto),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });

    it('throws UnprocessableEntityException for longitude out of range', async () => {
      const { service } = makeService();

      const dto = new UpdateLocationDto();
      dto.address = 'Alguna dirección';
      dto.latitude = 0;
      dto.longitude = 181;

      await expect(
        service.updateLocation('tenant-123', dto),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });
  });

  describe('getImageHistory', () => {
    it('returns image versions ordered by createdAt desc', async () => {
      const versions = [
        makeImageVersionRecord({
          id: 'v2',
          createdAt: new Date('2024-06-02T00:00:00Z'),
        }),
        makeImageVersionRecord({
          id: 'v1',
          createdAt: new Date('2024-06-01T00:00:00Z'),
        }),
      ];
      const prisma = makePrisma({
        imageVersionFindMany: jest.fn().mockResolvedValue(versions),
      });
      const { service } = makeService(prisma);

      const result = await service.getImageHistory('tenant-123');

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('v2');
      expect(result[1].id).toBe('v1');
      expect(result[0].createdAt).toBe('2024-06-02T00:00:00.000Z');
    });
  });
});

// ---------------------------------------------------------------------------
// 8.2 — Property 10: PATCH only updates submitted fields
// Validates: Requirements 5.7, 6.5
// ---------------------------------------------------------------------------

describe('ProfileService — Property 10: PATCH only updates submitted fields', () => {
  it('only submitted fields are passed to prisma.tenant.update', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate arbitrary subsets of { name, phone, timezone }
        fc.record(
          {
            name: fc.option(
              fc
                .string({ minLength: 2, maxLength: 100 })
                .filter((s) => s.trim().length >= 2),
              { nil: undefined },
            ),
            phone: fc.option(fc.stringMatching(/^\+[1-9]\d{1,14}$/), {
              nil: undefined,
            }),
            timezone: fc.option(
              fc.constantFrom(
                'America/Mexico_City',
                'America/Monterrey',
                'America/Tijuana',
              ),
              { nil: undefined },
            ),
          },
          { requiredKeys: [] },
        ),
        async (subset) => {
          const tenantUpdate = jest.fn().mockResolvedValue(makeTenantRecord());
          const prisma = makePrisma({ tenantUpdate });
          const { service } = makeService(prisma);

          const dto = new UpdateProfileDto();
          if (subset.name !== undefined) dto.name = subset.name;
          if (subset.phone !== undefined) dto.phone = subset.phone;
          if (subset.timezone !== undefined) dto.timezone = subset.timezone;

          await service.updateProfile('tenant-123', dto);

          const callArgs = tenantUpdate.mock.calls[0][0];
          const dataKeys = Object.keys(callArgs.data);

          // Only keys that were in the subset should appear in the update data
          for (const key of ['name', 'phone', 'timezone'] as const) {
            if (subset[key] !== undefined) {
              expect(dataKeys).toContain(key);
              expect(callArgs.data[key]).toBe(subset[key]);
            } else {
              expect(dataKeys).not.toContain(key);
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// 8.3 — Property 11: Business name length validation
// Validates: Requirements 6.1
// ---------------------------------------------------------------------------

describe('UpdateProfileDto — Property 11: Business name length validation', () => {
  it('rejects names shorter than 2 or longer than 100 characters', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc
          .string({ minLength: 0, maxLength: 200 })
          .filter((s) => s.length < 2 || s.length > 100),
        async (invalidName) => {
          const dto = new UpdateProfileDto();
          dto.name = invalidName;

          const errors = await validate(dto);
          const nameErrors = errors.filter((e) => e.property === 'name');
          expect(nameErrors.length).toBeGreaterThan(0);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('accepts names between 2 and 100 characters', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 2, maxLength: 100 }),
        async (validName) => {
          const dto = new UpdateProfileDto();
          dto.name = validName;

          const errors = await validate(dto);
          const nameErrors = errors.filter((e) => e.property === 'name');
          expect(nameErrors.length).toBe(0);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// 8.4 — Property 12: Phone E.164 format validation
// Validates: Requirements 6.2
// ---------------------------------------------------------------------------

describe('UpdateProfileDto — Property 12: Phone E.164 format validation', () => {
  const E164_REGEX = /^\+[1-9]\d{1,14}$/;

  it('rejects phone numbers not matching E.164 format', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc
          .string({ minLength: 1, maxLength: 20 })
          .filter((s) => !E164_REGEX.test(s)),
        async (invalidPhone) => {
          const dto = new UpdateProfileDto();
          dto.phone = invalidPhone;

          const errors = await validate(dto);
          const phoneErrors = errors.filter((e) => e.property === 'phone');
          expect(phoneErrors.length).toBeGreaterThan(0);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('accepts valid E.164 phone numbers', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.stringMatching(/^\+[1-9]\d{1,14}$/),
        async (validPhone) => {
          const dto = new UpdateProfileDto();
          dto.phone = validPhone;

          const errors = await validate(dto);
          const phoneErrors = errors.filter((e) => e.property === 'phone');
          expect(phoneErrors.length).toBe(0);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// 8.5 — Property 13: Timezone IANA validation
// Validates: Requirements 6.3
// ---------------------------------------------------------------------------

describe('UpdateProfileDto — Property 13: Timezone IANA validation', () => {
  // Known valid IANA timezones
  const VALID_TIMEZONES = [
    'America/Mexico_City',
    'America/Monterrey',
    'America/Tijuana',
    'America/Cancun',
    'UTC',
    'Europe/London',
    'Asia/Tokyo',
  ];

  it('accepts valid IANA timezone identifiers', async () => {
    for (const tz of VALID_TIMEZONES) {
      const dto = new UpdateProfileDto();
      dto.timezone = tz;

      const errors = await validate(dto);
      const tzErrors = errors.filter((e) => e.property === 'timezone');
      expect(tzErrors.length).toBe(0);
    }
  });

  it('rejects strings that are not valid IANA timezone identifiers', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate strings that are clearly not IANA timezones
        fc.string({ minLength: 1, maxLength: 50 }).filter((s) => {
          try {
            // Use Intl to check if it's a valid timezone
            Intl.DateTimeFormat(undefined, { timeZone: s });
            return false; // valid timezone — skip
          } catch {
            return true; // invalid timezone — use this
          }
        }),
        async (invalidTz) => {
          const dto = new UpdateProfileDto();
          dto.timezone = invalidTz;

          const errors = await validate(dto);
          const tzErrors = errors.filter((e) => e.property === 'timezone');
          expect(tzErrors.length).toBeGreaterThan(0);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// 8.6 — Property 8: Coordinate range validation
// Validates: Requirements 5.2, 5.3
// ---------------------------------------------------------------------------

describe('ProfileService — Property 8: Coordinate range validation', () => {
  it('throws UnprocessableEntityException for latitude outside [-90, 90]', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          fc.float({
            min: Math.fround(90.001),
            max: Math.fround(1000),
            noNaN: true,
          }),
          fc.float({
            min: Math.fround(-1000),
            max: Math.fround(-90.001),
            noNaN: true,
          }),
        ),
        fc.float({
          min: Math.fround(-180),
          max: Math.fround(180),
          noNaN: true,
        }),
        async (invalidLat, validLng) => {
          const tenantUpdate = jest.fn();
          const prisma = makePrisma({ tenantUpdate });
          const { service } = makeService(prisma);

          const dto = new UpdateLocationDto();
          dto.address = 'Test address';
          dto.latitude = invalidLat;
          dto.longitude = validLng;

          await expect(
            service.updateLocation('tenant-123', dto),
          ).rejects.toBeInstanceOf(UnprocessableEntityException);
          expect(tenantUpdate).not.toHaveBeenCalled();
        },
      ),
      { numRuns: 100 },
    );
  });

  it('throws UnprocessableEntityException for longitude outside [-180, 180]', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.float({ min: Math.fround(-90), max: Math.fround(90), noNaN: true }),
        fc.oneof(
          fc.float({
            min: Math.fround(180.001),
            max: Math.fround(1000),
            noNaN: true,
          }),
          fc.float({
            min: Math.fround(-1000),
            max: Math.fround(-180.001),
            noNaN: true,
          }),
        ),
        async (validLat, invalidLng) => {
          const tenantUpdate = jest.fn();
          const prisma = makePrisma({ tenantUpdate });
          const { service } = makeService(prisma);

          const dto = new UpdateLocationDto();
          dto.address = 'Test address';
          dto.latitude = validLat;
          dto.longitude = invalidLng;

          await expect(
            service.updateLocation('tenant-123', dto),
          ).rejects.toBeInstanceOf(UnprocessableEntityException);
          expect(tenantUpdate).not.toHaveBeenCalled();
        },
      ),
      { numRuns: 100 },
    );
  });

  it('accepts valid coordinate pairs within range', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.float({ min: Math.fround(-90), max: Math.fround(90), noNaN: true }),
        fc.float({
          min: Math.fround(-180),
          max: Math.fround(180),
          noNaN: true,
        }),
        async (lat, lng) => {
          const tenantUpdate = jest.fn().mockResolvedValue(makeTenantRecord());
          const prisma = makePrisma({ tenantUpdate });
          const { service } = makeService(prisma);

          const dto = new UpdateLocationDto();
          dto.address = 'Test address';
          dto.latitude = lat;
          dto.longitude = lng;

          await expect(
            service.updateLocation('tenant-123', dto),
          ).resolves.toBeDefined();
          expect(tenantUpdate).toHaveBeenCalledTimes(1);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// 8.7 — Property 9: Geocoding failure degrades gracefully
// Validates: Requirements 5.4, 5.5, 5.6
// ---------------------------------------------------------------------------

describe('ProfileService — Property 9: Geocoding failure degrades gracefully', () => {
  it('returns HTTP 200 with geocodingWarning and null coordinates when geocoder returns null', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 200 }),
        async (address) => {
          const geocoder = makeGeocoder(() => Promise.resolve(null));
          const tenantUpdate = jest.fn().mockResolvedValue(makeTenantRecord());
          const prisma = makePrisma({ tenantUpdate });
          const { service } = makeService(prisma, geocoder);

          const dto = new UpdateLocationDto();
          dto.address = address;
          // No explicit coordinates — triggers geocoding

          const result = await service.updateLocation('tenant-123', dto);

          expect(result.latitude).toBeNull();
          expect(result.longitude).toBeNull();
          expect(result.geocodingWarning).toBeDefined();
          expect(typeof result.geocodingWarning).toBe('string');
          // Address is stored
          expect(result.address).toBe(address);
          // Tenant was updated with null coordinates
          expect(tenantUpdate).toHaveBeenCalledWith(
            expect.objectContaining({
              data: expect.objectContaining({
                address,
                latitude: null,
                longitude: null,
              }),
            }),
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  it('returns HTTP 200 with geocodingWarning and null coordinates when geocoder throws', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 200 }),
        fc.string({ minLength: 1, maxLength: 100 }),
        async (address, errorMessage) => {
          const geocoder = makeGeocoder(() =>
            Promise.reject(new Error(errorMessage)),
          );
          const tenantUpdate = jest.fn().mockResolvedValue(makeTenantRecord());
          const prisma = makePrisma({ tenantUpdate });
          const { service } = makeService(prisma, geocoder);

          const dto = new UpdateLocationDto();
          dto.address = address;

          const result = await service.updateLocation('tenant-123', dto);

          expect(result.latitude).toBeNull();
          expect(result.longitude).toBeNull();
          expect(result.geocodingWarning).toBeDefined();
          expect(typeof result.geocodingWarning).toBe('string');
          expect(result.address).toBe(address);
          expect(tenantUpdate).toHaveBeenCalledWith(
            expect.objectContaining({
              data: expect.objectContaining({
                address,
                latitude: null,
                longitude: null,
              }),
            }),
          );
        },
      ),
      { numRuns: 100 },
    );
  });
});
