import { ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as fc from 'fast-check';
import { AuthService } from './auth.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeJwtService(): jest.Mocked<JwtService> {
  return { sign: jest.fn().mockReturnValue('mock-token') } as any;
}

function makeConfigService(): jest.Mocked<ConfigService> {
  return { get: jest.fn() } as any;
}

/**
 * Build a PrismaService mock whose $transaction throws the driver-adapter error
 * when called with a callback (interactive mode), simulating PrismaPg behaviour.
 * When called with an array (batch mode), it resolves each operation and returns
 * [tenantObject, userObject] so the service can destructure the result correctly.
 */
function makePrismaWithInteractiveTransactionError() {
  const mock = {
    user: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest
        .fn()
        .mockImplementation(({ data }: { data: Record<string, unknown> }) =>
          Promise.resolve({
            id: 'mock-user-id',
            email: data['email'] ?? 'mock@example.com',
            name: data['name'] ?? 'Mock User',
            role: data['role'] ?? 'OWNER',
            tenantId: data['tenantId'] ?? 'mock-tenant-id',
            passwordHash: data['passwordHash'] ?? null,
            isActive: true,
            googleId: data['googleId'] ?? null,
            createdAt: new Date(),
            updatedAt: new Date(),
          }),
        ),
      update: jest.fn(),
    },
    tenant: {
      create: jest.fn().mockResolvedValue({
        id: 'mock-tenant-id',
        name: 'Mock Tenant',
        slug: 'mock-tenant',
        trialEndsAt: new Date(),
        isActive: true,
        onboardedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
      findUnique: jest.fn().mockResolvedValue(null),
    },
    $transaction: jest.fn().mockImplementation(async (arg: unknown) => {
      if (typeof arg === 'function') {
        throw new Error(
          'Interactive transactions are not supported with driver adapters',
        );
      }
      // Batch mode — resolve each Prisma operation promise and return results
      if (Array.isArray(arg)) {
        const results: unknown[] = [];
        for (const op of arg) {
          results.push(await op);
        }
        return results;
      }
      return [];
    }),
  } as any;
  return mock;
}

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

const validBusinessName = fc
  .string({ minLength: 2, maxLength: 40 })
  .filter((s) => s.trim().length >= 2);

const validOwnerName = fc
  .string({ minLength: 2, maxLength: 40 })
  .filter((s) => s.trim().length >= 2);

const validEmail = fc.emailAddress();

const validPassword = fc
  .string({ minLength: 8, maxLength: 30 })
  .filter((s) => s.length >= 8);

const validRegisterDto = fc.record({
  businessName: validBusinessName,
  ownerName: validOwnerName,
  email: validEmail,
  password: validPassword,
});

// ---------------------------------------------------------------------------
// Task 1 — Bug Condition Exploration (Property 1)
// Validates: Requirements 1.1, 2.1, 2.2
// ---------------------------------------------------------------------------

describe('AuthService — Property 1: Bug Condition (unfixed code)', () => {
  /**
   * **Validates: Requirements 1.1, 2.1, 2.2**
   *
   * For any valid RegisterDto, `register` on UNFIXED code (interactive $transaction)
   * should NOT throw a Prisma driver-adapter exception and should return an accessToken.
   * This test is EXPECTED TO FAIL on unfixed code — failure confirms the bug exists.
   */
  it('register with valid payload should return accessToken without Prisma driver-adapter exception', async () => {
    await fc.assert(
      fc.asyncProperty(validRegisterDto, async (dto) => {
        const prisma = makePrismaWithInteractiveTransactionError();
        const service = new AuthService(
          prisma,
          makeJwtService(),
          makeConfigService(),
        );

        const result = await service.register(dto);

        expect(result.accessToken).toBeTruthy();
        expect(result.user.email).toBe(dto.email);
      }),
      { numRuns: 5 },
    );
  });

  /**
   * **Validates: Requirements 1.1, 2.1, 2.2**
   *
   * For any new Google profile, `findOrCreateGoogleUser` on UNFIXED code should NOT
   * throw a Prisma driver-adapter exception and should return an accessToken.
   * This test is EXPECTED TO FAIL on unfixed code — failure confirms the bug exists.
   */
  it('findOrCreateGoogleUser with new profile should return accessToken without Prisma driver-adapter exception', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          googleId: fc.string({ minLength: 10, maxLength: 30 }),
          email: validEmail,
          name: validOwnerName,
        }),
        async (profile) => {
          const prisma = makePrismaWithInteractiveTransactionError();
          // No existing user by googleId or email
          prisma.user.findUnique.mockResolvedValue(null);
          const service = new AuthService(
            prisma,
            makeJwtService(),
            makeConfigService(),
          );

          const result = await service.findOrCreateGoogleUser(profile);

          expect(result.accessToken).toBeTruthy();
        },
      ),
      { numRuns: 5 },
    );
  });
});

// ---------------------------------------------------------------------------
// Task 2 — Preservation Property Tests (Property 2)
// Validates: Requirements 3.1, 3.3, 3.4
// ---------------------------------------------------------------------------

describe('AuthService — Property 2: Preservation (unfixed code, non-buggy inputs)', () => {
  /**
   * **Validates: Requirement 3.1**
   *
   * For any email that already exists in the database, `register` ALWAYS throws
   * ConflictException BEFORE reaching $transaction. This path is unaffected by the bug.
   */
  it('register with duplicate email always throws ConflictException (HTTP 409)', async () => {
    await fc.assert(
      fc.asyncProperty(validRegisterDto, async (dto) => {
        const prisma = makePrismaWithInteractiveTransactionError();
        // Simulate existing user with the same email
        prisma.user.findUnique.mockResolvedValue({
          id: 'existing-id',
          email: dto.email,
          passwordHash: 'hash',
          name: 'Existing',
          role: 'OWNER',
          tenantId: 'tenant-id',
          isActive: true,
          googleId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        const service = new AuthService(
          prisma,
          makeJwtService(),
          makeConfigService(),
        );

        await expect(service.register(dto)).rejects.toThrow(ConflictException);
        await expect(service.register(dto)).rejects.toThrow(
          'Ya existe una cuenta con este email',
        );
        // $transaction must never be called — the conflict is caught before it
        expect(prisma.$transaction).not.toHaveBeenCalled();
      }),
      { numRuns: 20 },
    );
  });

  /**
   * **Validates: Requirement 3.3**
   *
   * For any business name whose generated slug is already taken, `ensureUniqueSlug`
   * (tested indirectly via `register`) always returns a slug with a numeric suffix
   * (`slug-1`, `slug-2`, …) so that the final slug is unique.
   *
   * Strategy: use a Prisma mock that supports batch $transaction (so register can
   * complete), capture the slug passed to `tenant.create`, and assert it is unique
   * (not in the occupied set). We also verify the slug iteration pattern by checking
   * that `tenant.findUnique` was called for each occupied slug.
   *
   * We filter out business names that produce an empty slug (e.g. "!!") since those
   * are not valid business names in practice.
   */
  it('ensureUniqueSlug always returns a unique slug with numeric suffix when base slug is taken', async () => {
    function generateSlug(name: string): string {
      return name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
    }

    await fc.assert(
      fc.asyncProperty(
        // Only use business names that produce a non-empty slug
        validBusinessName.filter((name) => generateSlug(name).length > 0),
        fc.integer({ min: 1, max: 5 }),
        async (businessName, collisions) => {
          const baseSlug = generateSlug(businessName);

          // Occupied slugs: base, base-1, …, base-(collisions-1)
          const occupied = new Set<string>([baseSlug]);
          for (let i = 1; i < collisions; i++) {
            occupied.add(`${baseSlug}-${i}`);
          }
          // The first free slug
          const expectedSlug =
            collisions === 1 ? baseSlug : `${baseSlug}-${collisions - 1}`;

          // Build a prisma mock that supports BOTH interactive (throws) and batch modes
          const tenantCreateMock = jest.fn().mockResolvedValue({
            id: 'tenant-id',
            slug: expectedSlug,
            name: businessName,
          });
          const userCreateMock = jest.fn().mockResolvedValue({
            id: 'user-id',
            email: 'test@example.com',
            name: 'Owner',
            role: 'OWNER',
            tenantId: 'tenant-id',
          });
          const tenantFindUniqueMock = jest
            .fn()
            .mockImplementation(({ where }: { where: { slug: string } }) =>
              Promise.resolve(
                occupied.has(where.slug) ? { id: 'x', slug: where.slug } : null,
              ),
            );

          const prisma = {
            user: {
              findUnique: jest.fn().mockResolvedValue(null),
              create: userCreateMock,
              update: jest.fn(),
            },
            tenant: {
              create: tenantCreateMock,
              findUnique: tenantFindUniqueMock,
            },
            $transaction: jest.fn().mockImplementation(async (arg: unknown) => {
              if (typeof arg === 'function') {
                // Interactive mode — simulate the actual service behaviour so
                // ensureUniqueSlug runs inside the callback
                return arg(prisma);
              }
              // Batch mode — execute each operation in sequence
              if (Array.isArray(arg)) {
                const results: unknown[] = [];
                for (const op of arg) {
                  results.push(await op);
                }
                return results;
              }
              return [];
            }),
          } as any;

          const service = new AuthService(
            prisma,
            makeJwtService(),
            makeConfigService(),
          );

          await service.register({
            businessName,
            ownerName: 'Owner',
            email: 'test@example.com',
            password: 'password123',
          });

          // Verify that ensureUniqueSlug iterated through all occupied slugs
          const slugsQueried = tenantFindUniqueMock.mock.calls.map(
            (call: [{ where: { slug: string } }]) => call[0].where.slug,
          );

          // The base slug must always be checked
          expect(slugsQueried).toContain(baseSlug);

          // All occupied slugs must have been checked
          for (const slug of occupied) {
            expect(slugsQueried).toContain(slug);
          }

          // The slug used in tenant.create must NOT be in the occupied set
          const slugUsed: string = tenantCreateMock.mock.calls[0][0].data.slug;
          expect(occupied.has(slugUsed)).toBe(false);
        },
      ),
      { numRuns: 20 },
    );
  });

  /**
   * **Validates: Requirement 3.4**
   *
   * For any Google profile whose googleId already exists in the database,
   * `findOrCreateGoogleUser` returns the existing user WITHOUT calling $transaction.
   * This path is completely unaffected by the bug.
   */
  it('findOrCreateGoogleUser with existing googleId returns existing user without calling $transaction', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          googleId: fc.string({ minLength: 10, maxLength: 30 }),
          email: validEmail,
          name: validOwnerName,
        }),
        async (profile) => {
          const existingUser = {
            id: 'existing-user-id',
            email: profile.email,
            name: profile.name,
            role: 'OWNER',
            tenantId: 'existing-tenant-id',
            googleId: profile.googleId,
            passwordHash: null,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          };

          const prisma = makePrismaWithInteractiveTransactionError();
          // First findUnique (by googleId) returns the existing user
          prisma.user.findUnique.mockResolvedValue(existingUser);

          const service = new AuthService(
            prisma,
            makeJwtService(),
            makeConfigService(),
          );
          const result = await service.findOrCreateGoogleUser(profile);

          expect(result.accessToken).toBeTruthy();
          expect(result.user.id).toBe(existingUser.id);
          expect(result.user.email).toBe(existingUser.email);
          // $transaction must never be called for existing users
          expect(prisma.$transaction).not.toHaveBeenCalled();
        },
      ),
      { numRuns: 20 },
    );
  });
});
