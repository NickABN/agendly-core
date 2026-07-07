import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { TokenService } from './token.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

function makeJwt(): jest.Mocked<JwtService> {
  return { sign: jest.fn().mockReturnValue('new-access-token') } as any;
}

// Config sin overrides → cada get() devuelve el default (7d sliding / 30d absoluto).
function makeConfig(): jest.Mocked<ConfigService> {
  return { get: jest.fn((_key: string, def?: string) => def) } as any;
}

function makePrisma() {
  const prisma = {
    refreshToken: {
      create: jest.fn().mockResolvedValue({}),
      findUnique: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    $transaction: jest.fn().mockImplementation(async (arg: unknown) => {
      if (typeof arg === 'function') {
        return arg({
          refreshToken: {
            create: prisma.refreshToken.create,
            update: prisma.refreshToken.update,
            updateMany: prisma.refreshToken.updateMany,
          },
        });
      }
      if (Array.isArray(arg)) {
        const results: unknown[] = [];
        for (const op of arg) results.push(await op);
        return results;
      }
      return [];
    }),
  } as any;

  return prisma;
}

function validRow(overrides: Record<string, unknown> = {}) {
  const now = Date.now();
  return {
    id: 'rt1',
    userId: 'u1',
    familyId: 'fam1',
    tokenHash: sha256Hex('good-secret'),
    expiresAt: new Date(now + 60 * 60 * 1000),
    familyExpiresAt: new Date(now + 24 * 60 * 60 * 1000),
    revokedAt: null,
    replacedByTokenId: null,
    user: { id: 'u1', tenantId: 't1', role: 'OWNER', isActive: true },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------

describe('TokenService', () => {
  describe('issueRefreshToken', () => {
    it('persiste el hash (nunca el secreto) y devuelve id.secret', async () => {
      const prisma = makePrisma();
      const svc = new TokenService(prisma, makeJwt(), makeConfig());

      const cookie = await svc.issueRefreshToken('user-1');

      expect(prisma.refreshToken.create).toHaveBeenCalledTimes(1);
      const data = prisma.refreshToken.create.mock.calls[0][0].data;
      expect(data.userId).toBe('user-1');

      const dot = cookie.indexOf('.');
      const id = cookie.slice(0, dot);
      const secret = cookie.slice(dot + 1);
      expect(id).toBe(data.id);
      expect(sha256Hex(secret)).toBe(data.tokenHash);
      // El secreto en claro jamás se guarda.
      expect(JSON.stringify(data)).not.toContain(secret);
    });
  });

  describe('rotate — happy path', () => {
    it('revoca el viejo, encadena y crea uno nuevo en la misma familia', async () => {
      const prisma = makePrisma();
      const row = validRow();
      prisma.refreshToken.findUnique.mockResolvedValue(row);
      const svc = new TokenService(prisma, makeJwt(), makeConfig());

      const res = await svc.rotate('rt1.good-secret');

      expect(res.accessToken).toBe('new-access-token');
      expect(res.refreshCookieValue).toContain('.');
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);

      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { id: 'rt1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });

      const upd = prisma.refreshToken.update.mock.calls[0][0];
      expect(upd.where.id).toBe('rt1');

      const created = prisma.refreshToken.create.mock.calls[0][0].data;
      expect(created.familyId).toBe('fam1');
      // El nuevo token hereda el tope absoluto de la familia (deslizante con cap).
      expect(created.familyExpiresAt).toEqual(row.familyExpiresAt);
      // El nuevo id es el encadenado en replacedByTokenId.
      expect(created.id).toBe(upd.data.replacedByTokenId);
    });

    it('rechaza una rotación concurrente si el token ya fue consumido atómicamente', async () => {
      const prisma = makePrisma();
      prisma.refreshToken.findUnique.mockResolvedValue(validRow());
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 0 });
      const svc = new TokenService(prisma, makeJwt(), makeConfig());

      await expect(svc.rotate('rt1.good-secret')).rejects.toThrow(
        UnauthorizedException,
      );

      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { id: 'rt1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
      expect(prisma.refreshToken.create).not.toHaveBeenCalled();
      expect(prisma.refreshToken.update).not.toHaveBeenCalled();
    });
  });

  describe('rotate — rechazos', () => {
    it('token expirado → 401 sin rotación', async () => {
      const prisma = makePrisma();
      prisma.refreshToken.findUnique.mockResolvedValue(
        validRow({ expiresAt: new Date(Date.now() - 1000) }),
      );
      const svc = new TokenService(prisma, makeJwt(), makeConfig());

      await expect(svc.rotate('rt1.good-secret')).rejects.toThrow(
        UnauthorizedException,
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.refreshToken.update).not.toHaveBeenCalled();
    });

    it('familia pasó el tope absoluto → 401', async () => {
      const prisma = makePrisma();
      prisma.refreshToken.findUnique.mockResolvedValue(
        validRow({ familyExpiresAt: new Date(Date.now() - 1000) }),
      );
      const svc = new TokenService(prisma, makeJwt(), makeConfig());

      await expect(svc.rotate('rt1.good-secret')).rejects.toThrow(
        UnauthorizedException,
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('reuso de token ya revocado → revoca la familia entera + 401', async () => {
      const prisma = makePrisma();
      prisma.refreshToken.findUnique.mockResolvedValue(
        validRow({ revokedAt: new Date() }),
      );
      const svc = new TokenService(prisma, makeJwt(), makeConfig());

      await expect(svc.rotate('rt1.good-secret')).rejects.toThrow(
        UnauthorizedException,
      );
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { familyId: 'fam1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('secreto incorrecto → 401 SIN revocar la familia', async () => {
      const prisma = makePrisma();
      prisma.refreshToken.findUnique.mockResolvedValue(validRow());
      const svc = new TokenService(prisma, makeJwt(), makeConfig());

      await expect(svc.rotate('rt1.wrong-secret')).rejects.toThrow(
        UnauthorizedException,
      );
      expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('usuario inactivo → 401', async () => {
      const prisma = makePrisma();
      prisma.refreshToken.findUnique.mockResolvedValue(
        validRow({
          user: { id: 'u1', tenantId: 't1', role: 'OWNER', isActive: false },
        }),
      );
      const svc = new TokenService(prisma, makeJwt(), makeConfig());

      await expect(svc.rotate('rt1.good-secret')).rejects.toThrow(
        UnauthorizedException,
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('token inexistente → 401', async () => {
      const prisma = makePrisma();
      prisma.refreshToken.findUnique.mockResolvedValue(null);
      const svc = new TokenService(prisma, makeJwt(), makeConfig());

      await expect(svc.rotate('rtX.whatever')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('revoke / revokeAllForUser', () => {
    it('revoke wholeFamily revoca todas las no-revocadas de la familia', async () => {
      const prisma = makePrisma();
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt1',
        familyId: 'fam1',
        revokedAt: null,
      });
      const svc = new TokenService(prisma, makeJwt(), makeConfig());

      await svc.revoke('rt1.secret', { wholeFamily: true });

      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { familyId: 'fam1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('revoke con cookie ausente es no-op', async () => {
      const prisma = makePrisma();
      const svc = new TokenService(prisma, makeJwt(), makeConfig());

      await svc.revoke(undefined);

      expect(prisma.refreshToken.findUnique).not.toHaveBeenCalled();
      expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled();
    });

    it('revokeAllForUser revoca todas las familias del usuario', async () => {
      const prisma = makePrisma();
      const svc = new TokenService(prisma, makeJwt(), makeConfig());

      await svc.revokeAllForUser('u1');

      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'u1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });
  });
});
