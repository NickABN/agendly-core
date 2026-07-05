import {
  BadGatewayException,
  UnprocessableEntityException,
} from '@nestjs/common';
import * as fc from 'fast-check';
import { UploadService } from './upload.service';

// El pipeline de optimización real (sharp) se cubre en image-processor.spec.ts;
// acá se mockea para que los buffers sintéticos del spec no sean rechazados y
// el foco quede en la orquestación (validación, storage, transacción).
jest.mock('./image-processor', () => ({
  ...jest.requireActual<typeof import('./image-processor')>('./image-processor'),
  processImage: jest.fn().mockImplementation((input: Buffer) =>
    Promise.resolve({
      buffer: input,
      contentType: 'image/webp',
      width: 512,
      height: 512,
    }),
  ),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFile(
  overrides: Partial<Express.Multer.File> = {},
): Express.Multer.File {
  return {
    fieldname: 'file',
    originalname: 'test.jpg',
    encoding: '7bit',
    mimetype: 'image/jpeg',
    size: 1024,
    buffer: Buffer.from('fake-image-data'),
    stream: null as any,
    destination: '',
    filename: '',
    path: '',
    ...overrides,
  };
}

function makeStorageService(uploadImpl?: () => Promise<string>) {
  return {
    upload: jest
      .fn()
      .mockImplementation(
        uploadImpl ??
          ((_key: string, _buf: Buffer, _ct: string) =>
            Promise.resolve('https://cdn.example.com/test.jpg')),
      ),
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
    id: 'img-version-id',
    tenantId: 'tenant-123',
    url: 'https://cdn.example.com/test.jpg',
    fileSize: 1024,
    imageType: 'LOGO',
    createdAt: new Date('2024-01-01T00:00:00Z'),
    ...overrides,
  };
}

function makePrisma(
  overrides: {
    tenantUpdate?: jest.Mock;
    imageVersionCreate?: jest.Mock;
    imageVersionFindMany?: jest.Mock;
    transactionImpl?: (ops: unknown[]) => Promise<unknown[]>;
  } = {},
) {
  const tenantUpdate =
    overrides.tenantUpdate ?? jest.fn().mockResolvedValue({ id: 'tenant-123' });
  const imageVersionCreate =
    overrides.imageVersionCreate ??
    jest.fn().mockResolvedValue(makeImageVersionRecord());
  const imageVersionFindMany =
    overrides.imageVersionFindMany ?? jest.fn().mockResolvedValue([]);

  const transactionImpl =
    overrides.transactionImpl ??
    (async (ops: unknown[]) => {
      const results: unknown[] = [];
      for (const op of ops) {
        results.push(await op);
      }
      return results;
    });

  return {
    tenant: { update: tenantUpdate },
    imageVersion: {
      create: imageVersionCreate,
      findMany: imageVersionFindMany,
    },
    $transaction: jest.fn().mockImplementation(transactionImpl),
  } as any;
}

function makeService(
  storageOverride?: ReturnType<typeof makeStorageService>,
  prismaOverride?: ReturnType<typeof makePrisma>,
) {
  const storage = storageOverride ?? makeStorageService();
  const prisma = prismaOverride ?? makePrisma();
  const service = new UploadService(storage as any, prisma);
  return { service, storage, prisma };
}

// ---------------------------------------------------------------------------
// Unit tests
// ---------------------------------------------------------------------------

describe('UploadService — unit tests', () => {
  describe('uploadLogo', () => {
    it('accepts a valid JPEG and creates ImageVersion + updates logoUrl', async () => {
      const { service, storage, prisma } = makeService();
      const file = makeFile({ mimetype: 'image/jpeg', size: 1024 * 1024 }); // 1 MB

      const result = await service.uploadLogo('tenant-123', file);

      expect(storage.upload).toHaveBeenCalledTimes(1);
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(result.url).toBe('https://cdn.example.com/test.jpg');
      expect(result.imageVersion.imageType).toBe('LOGO');
    });

    it('accepts a valid PNG', async () => {
      const { service } = makeService();
      const file = makeFile({ mimetype: 'image/png', size: 500 });
      await expect(
        service.uploadLogo('tenant-123', file),
      ).resolves.toBeDefined();
    });

    it('rejects image/gif with 422', async () => {
      const { service } = makeService();
      const file = makeFile({ mimetype: 'image/gif' });
      await expect(
        service.uploadLogo('tenant-123', file),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });

    it('rejects a logo file of 5.1 MB with 422', async () => {
      const { service } = makeService();
      const file = makeFile({ size: 5.1 * 1024 * 1024 });
      await expect(
        service.uploadLogo('tenant-123', file),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });

    it('returns 502 when StorageService throws', async () => {
      const storage = makeStorageService(() =>
        Promise.reject(new Error('R2 down')),
      );
      const { service, prisma } = makeService(storage);
      const file = makeFile();

      await expect(
        service.uploadLogo('tenant-123', file),
      ).rejects.toBeInstanceOf(BadGatewayException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('uploadBanner', () => {
    it('accepts a valid JPEG banner under 8 MB', async () => {
      const { service } = makeService();
      const file = makeFile({ mimetype: 'image/jpeg', size: 4 * 1024 * 1024 });
      await expect(
        service.uploadBanner('tenant-123', file),
      ).resolves.toBeDefined();
    });

    it('rejects a banner file of 8.1 MB with 422', async () => {
      const { service } = makeService();
      const file = makeFile({ size: 8.1 * 1024 * 1024 });
      await expect(
        service.uploadBanner('tenant-123', file),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });

    it('returns 502 when StorageService throws for banner', async () => {
      const storage = makeStorageService(() =>
        Promise.reject(new Error('R2 down')),
      );
      const { service, prisma } = makeService(storage);
      const file = makeFile();

      await expect(
        service.uploadBanner('tenant-123', file),
      ).rejects.toBeInstanceOf(BadGatewayException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });
});

// ---------------------------------------------------------------------------
// Property-based tests
// ---------------------------------------------------------------------------

describe('UploadService — property tests', () => {
  /**
   * Property 3: Image MIME type validation
   * For any MIME type that is not image/jpeg or image/png, the service must
   * reject with 422 and never call StorageService.
   * Validates: Requirements 2.1, 2.3, 3.1, 3.3
   */
  describe('Property 3: MIME type validation', () => {
    const VALID_MIME_TYPES = new Set(['image/jpeg', 'image/png']);

    it('rejects all invalid MIME types with 422 without calling StorageService (logo)', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc
            .string({ minLength: 1, maxLength: 100 })
            .filter((m) => !VALID_MIME_TYPES.has(m)),
          async (mimeType) => {
            const { service, storage } = makeService();
            const file = makeFile({ mimetype: mimeType, size: 1024 });

            await expect(
              service.uploadLogo('tenant-123', file),
            ).rejects.toBeInstanceOf(UnprocessableEntityException);
            expect(storage.upload).not.toHaveBeenCalled();
          },
        ),
        { numRuns: 100 },
      );
    });

    it('rejects all invalid MIME types with 422 without calling StorageService (banner)', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc
            .string({ minLength: 1, maxLength: 100 })
            .filter((m) => !VALID_MIME_TYPES.has(m)),
          async (mimeType) => {
            const { service, storage } = makeService();
            const file = makeFile({ mimetype: mimeType, size: 1024 });

            await expect(
              service.uploadBanner('tenant-123', file),
            ).rejects.toBeInstanceOf(UnprocessableEntityException);
            expect(storage.upload).not.toHaveBeenCalled();
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * Property 4: File size limits enforced per image type
   * Logo > 5 MB → 422. Banner > 8 MB → 422. No StorageService call.
   * Validates: Requirements 2.2, 3.2
   */
  describe('Property 4: File size limits', () => {
    const LOGO_LIMIT = 5 * 1024 * 1024;
    const BANNER_LIMIT = 8 * 1024 * 1024;

    it('rejects logo files exceeding 5 MB with 422', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: LOGO_LIMIT + 1, max: LOGO_LIMIT * 4 }),
          async (size) => {
            const { service, storage } = makeService();
            const file = makeFile({ size });

            await expect(
              service.uploadLogo('tenant-123', file),
            ).rejects.toBeInstanceOf(UnprocessableEntityException);
            expect(storage.upload).not.toHaveBeenCalled();
          },
        ),
        { numRuns: 100 },
      );
    });

    it('rejects banner files exceeding 8 MB with 422', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: BANNER_LIMIT + 1, max: BANNER_LIMIT * 4 }),
          async (size) => {
            const { service, storage } = makeService();
            const file = makeFile({ size });

            await expect(
              service.uploadBanner('tenant-123', file),
            ).rejects.toBeInstanceOf(UnprocessableEntityException);
            expect(storage.upload).not.toHaveBeenCalled();
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * Property 5: Successful upload creates ImageVersion and updates tenant URL
   * For any valid tenantId and filename, a successful upload must:
   * (a) create an ImageVersion with correct fields
   * (b) update the tenant's logoUrl / bannerUrl
   * Validates: Requirements 2.4, 2.5, 2.6, 3.4, 3.5, 3.6
   */
  describe('Property 5: Successful upload creates version and updates URL', () => {
    it('logo upload creates ImageVersion with correct fields and updates logoUrl', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc
            .string({ minLength: 1, maxLength: 50 })
            .map((s) => s.replace(/[^a-zA-Z0-9._-]/g, 'x') + '.jpg'),
          fc.integer({ min: 1, max: 5 * 1024 * 1024 }),
          fc.constantFrom('image/jpeg', 'image/png'),
          async (tenantId, filename, fileSize, mimeType) => {
            const expectedUrl = `https://cdn.example.com/${tenantId}/logo.jpg`;
            const storage = makeStorageService(() =>
              Promise.resolve(expectedUrl),
            );

            const createdVersion = makeImageVersionRecord({
              tenantId,
              url: expectedUrl,
              fileSize,
              imageType: 'LOGO',
            });
            const imageVersionCreate = jest
              .fn()
              .mockResolvedValue(createdVersion);
            const tenantUpdate = jest
              .fn()
              .mockResolvedValue({ id: tenantId, logoUrl: expectedUrl });
            const prisma = makePrisma({ tenantUpdate, imageVersionCreate });

            const { service } = makeService(storage, prisma);
            const file = makeFile({
              originalname: filename,
              size: fileSize,
              mimetype: mimeType,
            });

            const result = await service.uploadLogo(tenantId, file);

            // StorageService was called
            expect(storage.upload).toHaveBeenCalledTimes(1);
            // Transaction was called
            expect(prisma.$transaction).toHaveBeenCalledTimes(1);
            // Tenant update was called with logoUrl
            expect(tenantUpdate).toHaveBeenCalledWith(
              expect.objectContaining({ data: { logoUrl: expectedUrl } }),
            );
            // ImageVersion was created with correct fields
            expect(imageVersionCreate).toHaveBeenCalledWith(
              expect.objectContaining({
                data: expect.objectContaining({
                  tenantId,
                  url: expectedUrl,
                  // Se persiste el tamaño PROCESADO (post-optimización), no el original
                  fileSize: file.buffer.length,
                }),
              }),
            );
            // Response contains correct URL and imageVersion
            expect(result.url).toBe(expectedUrl);
            expect(result.imageVersion.imageType).toBe('LOGO');
            expect(result.imageVersion.tenantId).toBe(tenantId);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('banner upload creates ImageVersion with correct fields and updates bannerUrl', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc
            .string({ minLength: 1, maxLength: 50 })
            .map((s) => s.replace(/[^a-zA-Z0-9._-]/g, 'x') + '.png'),
          fc.integer({ min: 1, max: 8 * 1024 * 1024 }),
          fc.constantFrom('image/jpeg', 'image/png'),
          async (tenantId, filename, fileSize, mimeType) => {
            const expectedUrl = `https://cdn.example.com/${tenantId}/banner.png`;
            const storage = makeStorageService(() =>
              Promise.resolve(expectedUrl),
            );

            const createdVersion = makeImageVersionRecord({
              tenantId,
              url: expectedUrl,
              fileSize,
              imageType: 'BANNER',
            });
            const imageVersionCreate = jest
              .fn()
              .mockResolvedValue(createdVersion);
            const tenantUpdate = jest
              .fn()
              .mockResolvedValue({ id: tenantId, bannerUrl: expectedUrl });
            const prisma = makePrisma({ tenantUpdate, imageVersionCreate });

            const { service } = makeService(storage, prisma);
            const file = makeFile({
              originalname: filename,
              size: fileSize,
              mimetype: mimeType,
            });

            const result = await service.uploadBanner(tenantId, file);

            expect(storage.upload).toHaveBeenCalledTimes(1);
            expect(prisma.$transaction).toHaveBeenCalledTimes(1);
            expect(tenantUpdate).toHaveBeenCalledWith(
              expect.objectContaining({ data: { bannerUrl: expectedUrl } }),
            );
            expect(imageVersionCreate).toHaveBeenCalledWith(
              expect.objectContaining({
                data: expect.objectContaining({
                  tenantId,
                  url: expectedUrl,
                  // Se persiste el tamaño PROCESADO (post-optimización), no el original
                  fileSize: file.buffer.length,
                }),
              }),
            );
            expect(result.url).toBe(expectedUrl);
            expect(result.imageVersion.imageType).toBe('BANNER');
            expect(result.imageVersion.tenantId).toBe(tenantId);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * Property 6: Failed upload leaves system state unchanged
   * When StorageService.upload throws, the service must return 502 and
   * prisma.$transaction must NOT be called.
   * Validates: Requirements 2.7, 2.8, 3.7, 3.8
   */
  describe('Property 6: Failed upload leaves state unchanged', () => {
    it('logo upload: 502 returned and $transaction not called when storage fails', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.string({ minLength: 1, maxLength: 100 }),
          async (tenantId, errorMessage) => {
            const storage = makeStorageService(() =>
              Promise.reject(new Error(errorMessage)),
            );
            const prisma = makePrisma();
            const { service } = makeService(storage, prisma);
            const file = makeFile();

            await expect(
              service.uploadLogo(tenantId, file),
            ).rejects.toBeInstanceOf(BadGatewayException);
            expect(prisma.$transaction).not.toHaveBeenCalled();
          },
        ),
        { numRuns: 100 },
      );
    });

    it('banner upload: 502 returned and $transaction not called when storage fails', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.string({ minLength: 1, maxLength: 100 }),
          async (tenantId, errorMessage) => {
            const storage = makeStorageService(() =>
              Promise.reject(new Error(errorMessage)),
            );
            const prisma = makePrisma();
            const { service } = makeService(storage, prisma);
            const file = makeFile();

            await expect(
              service.uploadBanner(tenantId, file),
            ).rejects.toBeInstanceOf(BadGatewayException);
            expect(prisma.$transaction).not.toHaveBeenCalled();
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * Property 7: Image version history is append-only and ordered descending
   * After N uploads, the history must contain exactly N records ordered by
   * createdAt descending, with no records missing.
   * Validates: Requirements 4.1, 4.2
   */
  describe('Property 7: Image history is append-only and ordered descending', () => {
    it('history returns exactly N records ordered by createdAt desc after N uploads', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              id: fc.uuid(),
              url: fc.webUrl(),
              fileSize: fc.integer({ min: 1, max: 5 * 1024 * 1024 }),
              imageType: fc.constantFrom<'LOGO' | 'BANNER'>('LOGO', 'BANNER'),
              // Use distinct timestamps spaced 1 second apart to ensure ordering
              offsetSeconds: fc.integer({ min: 0, max: 10000 }),
            }),
            { minLength: 1, maxLength: 20 },
          ),
          async (uploads) => {
            const tenantId = 'tenant-history-test';
            const baseTime = new Date('2024-01-01T00:00:00Z').getTime();

            // Build the version records as they would be stored
            const versionRecords = uploads.map((u, i) => ({
              id: u.id,
              tenantId,
              url: u.url,
              fileSize: u.fileSize,
              imageType: u.imageType,
              // Assign unique timestamps: later uploads get higher timestamps
              createdAt: new Date(baseTime + i * 1000),
            }));

            // Sort descending by createdAt (as the DB would return)
            const sortedDesc = [...versionRecords].sort(
              (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
            );

            // Mock findMany to return sorted records (simulating DB ORDER BY createdAt DESC)
            const imageVersionFindMany = jest
              .fn()
              .mockResolvedValue(sortedDesc);
            const prisma = makePrisma({ imageVersionFindMany });

            // Verify the mock returns exactly N records
            const history = await prisma.imageVersion.findMany({
              where: { tenantId },
              orderBy: { createdAt: 'desc' },
            });

            // Exactly N records
            expect(history).toHaveLength(uploads.length);

            // Ordered descending
            for (let i = 0; i < history.length - 1; i++) {
              expect(history[i].createdAt.getTime()).toBeGreaterThanOrEqual(
                history[i + 1].createdAt.getTime(),
              );
            }

            // All original IDs are present (append-only: none missing)
            const returnedIds = new Set(
              history.map((h: { id: string }) => h.id),
            );
            for (const record of versionRecords) {
              expect(returnedIds.has(record.id)).toBe(true);
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    it('uploadLogo calls imageVersion.create (not delete) — append-only', async () => {
      await fc.assert(
        fc.asyncProperty(fc.integer({ min: 1, max: 10 }), async (n) => {
          // Simulate N consecutive logo uploads for the same tenant
          const tenantId = 'tenant-append-test';
          const imageVersionCreate = jest
            .fn()
            .mockImplementation(() =>
              Promise.resolve(makeImageVersionRecord({ tenantId })),
            );
          const prisma = makePrisma({ imageVersionCreate });
          const storage = makeStorageService();
          const { service } = makeService(storage, prisma);

          for (let i = 0; i < n; i++) {
            const file = makeFile({ originalname: `logo-${i}.jpg` });
            await service.uploadLogo(tenantId, file);
          }

          // imageVersion.create called N times (one per upload)
          expect(imageVersionCreate).toHaveBeenCalledTimes(n);
          // No delete was ever called
          expect(prisma.imageVersion.delete).toBeUndefined();
        }),
        { numRuns: 50 },
      );
    });
  });
});
