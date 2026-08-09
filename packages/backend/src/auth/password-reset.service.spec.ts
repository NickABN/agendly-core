import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import * as bcrypt from 'bcrypt';
import { PasswordResetService } from './password-reset.service';
import { TokenService } from './token.service';
import { EmailService } from '../email/email.service';

jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('mock-password-hash'),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

function makeConfig(values: Record<string, string> = {}): ConfigService {
  return {
    get: jest.fn((key: string, def?: string) => values[key] ?? def),
  } as unknown as ConfigService;
}

function makeTokenService(): jest.Mocked<TokenService> {
  return {
    revokeAllForUser: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<TokenService>;
}

function makeEmailService(): jest.Mocked<EmailService> {
  return {
    sendPasswordReset: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<EmailService>;
}

function makePrisma() {
  return {
    user: {
      findUnique: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue({}),
    },
    passwordResetToken: {
      create: jest.fn().mockResolvedValue({}),
      findUnique: jest.fn().mockResolvedValue(null),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  } as any;
}

function makeService(
  prisma: any,
  email = makeEmailService(),
  tokens = makeTokenService(),
) {
  return {
    service: new PasswordResetService(prisma, makeConfig(), tokens, email),
    email,
    tokens,
  };
}

const passwordUser = {
  id: 'u1',
  email: 'ana@example.com',
  passwordHash: 'old-bcrypt-hash',
  isActive: true,
};

function validTokenRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'prt1',
    userId: 'u1',
    tokenHash: sha256Hex('raw-token'),
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    usedAt: null,
    createdAt: new Date(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------

describe('PasswordResetService.requestReset', () => {
  it('does nothing observable for an unknown email (anti-enumeration)', async () => {
    const prisma = makePrisma();
    prisma.user.findUnique.mockResolvedValue(null);
    const { service, email } = makeService(prisma);

    await expect(
      service.requestReset('nobody@example.com'),
    ).resolves.toBeUndefined();

    expect(prisma.passwordResetToken.create).not.toHaveBeenCalled();
    expect(prisma.passwordResetToken.updateMany).not.toHaveBeenCalled();
    expect(email.sendPasswordReset).not.toHaveBeenCalled();
  });

  it('does nothing observable for a Google-only account (no password hash)', async () => {
    const prisma = makePrisma();
    prisma.user.findUnique.mockResolvedValue({
      ...passwordUser,
      passwordHash: null,
    });
    const { service, email } = makeService(prisma);

    await expect(
      service.requestReset('ana@example.com'),
    ).resolves.toBeUndefined();

    expect(prisma.passwordResetToken.create).not.toHaveBeenCalled();
    expect(email.sendPasswordReset).not.toHaveBeenCalled();
  });

  it('invalidates previous unused tokens before creating a new one', async () => {
    const prisma = makePrisma();
    prisma.user.findUnique.mockResolvedValue(passwordUser);
    const { service } = makeService(prisma);

    await service.requestReset('ana@example.com');

    expect(prisma.passwordResetToken.updateMany).toHaveBeenCalledWith({
      where: { userId: 'u1', usedAt: null },
      data: { usedAt: expect.any(Date) },
    });
    const updateOrder =
      prisma.passwordResetToken.updateMany.mock.invocationCallOrder[0];
    const createOrder =
      prisma.passwordResetToken.create.mock.invocationCallOrder[0];
    expect(updateOrder).toBeLessThan(createOrder);
  });

  it('stores only the SHA-256 of the token and emails the raw token in the reset link', async () => {
    const prisma = makePrisma();
    prisma.user.findUnique.mockResolvedValue(passwordUser);
    const { service, email } = makeService(prisma);

    await service.requestReset('ana@example.com');

    expect(email.sendPasswordReset).toHaveBeenCalledTimes(1);
    const [to, resetUrl] = email.sendPasswordReset.mock.calls[0];
    expect(to).toBe('ana@example.com');
    expect(resetUrl).toContain('/reset-password?token=');

    const rawToken = String(resetUrl).split('token=')[1];
    // 32 random bytes → 64 hex chars
    expect(rawToken).toMatch(/^[0-9a-f]{64}$/);

    const created = prisma.passwordResetToken.create.mock.calls[0][0].data;
    expect(created.userId).toBe('u1');
    expect(created.tokenHash).toBe(sha256Hex(rawToken));
    // The raw token is never persisted.
    expect(JSON.stringify(created)).not.toContain(rawToken);
  });

  it('builds the reset link from FRONTEND_URL (admin app, where login lives)', async () => {
    const prisma = makePrisma();
    prisma.user.findUnique.mockResolvedValue(passwordUser);
    const email = makeEmailService();
    const service = new PasswordResetService(
      prisma,
      makeConfig({ FRONTEND_URL: 'https://admin.agendly.mx/' }),
      makeTokenService(),
      email,
    );

    await service.requestReset('ana@example.com');

    const [, resetUrl] = email.sendPasswordReset.mock.calls[0];
    expect(resetUrl).toMatch(
      /^https:\/\/admin\.agendly\.mx\/reset-password\?token=/,
    );
  });

  it('sets a 30 minute expiry on the token', async () => {
    const prisma = makePrisma();
    prisma.user.findUnique.mockResolvedValue(passwordUser);
    const { service } = makeService(prisma);

    const before = Date.now();
    await service.requestReset('ana@example.com');
    const after = Date.now();

    const created = prisma.passwordResetToken.create.mock.calls[0][0].data;
    const ttl = 30 * 60 * 1000;
    expect(created.expiresAt.getTime()).toBeGreaterThanOrEqual(before + ttl);
    expect(created.expiresAt.getTime()).toBeLessThanOrEqual(after + ttl);
  });
});

describe('PasswordResetService.resetPassword', () => {
  it('rejects an unknown token with a Spanish 400', async () => {
    const prisma = makePrisma();
    prisma.passwordResetToken.findUnique.mockResolvedValue(null);
    const { service } = makeService(prisma);

    await expect(
      service.resetPassword('raw-token', 'NewPassword123'),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.resetPassword('raw-token', 'NewPassword123'),
    ).rejects.toThrow('El enlace de recuperación es inválido o ha expirado');
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('looks the token up by its SHA-256 hash, never by the raw value', async () => {
    const prisma = makePrisma();
    prisma.passwordResetToken.findUnique.mockResolvedValue(validTokenRow());
    const { service } = makeService(prisma);

    await service.resetPassword('raw-token', 'NewPassword123');

    expect(prisma.passwordResetToken.findUnique).toHaveBeenCalledWith({
      where: { tokenHash: sha256Hex('raw-token') },
    });
  });

  it('rejects an expired token', async () => {
    const prisma = makePrisma();
    prisma.passwordResetToken.findUnique.mockResolvedValue(
      validTokenRow({ expiresAt: new Date(Date.now() - 1000) }),
    );
    const { service } = makeService(prisma);

    await expect(
      service.resetPassword('raw-token', 'NewPassword123'),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('rejects an already-used token (single-use)', async () => {
    const prisma = makePrisma();
    prisma.passwordResetToken.findUnique.mockResolvedValue(
      validTokenRow({ usedAt: new Date() }),
    );
    const { service } = makeService(prisma);

    await expect(
      service.resetPassword('raw-token', 'NewPassword123'),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('re-hashes the password with the same bcrypt cost as register (12)', async () => {
    const prisma = makePrisma();
    prisma.passwordResetToken.findUnique.mockResolvedValue(validTokenRow());
    const { service } = makeService(prisma);

    await service.resetPassword('raw-token', 'NewPassword123');

    expect(bcrypt.hash).toHaveBeenCalledWith('NewPassword123', 12);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { passwordHash: 'mock-password-hash' },
    });
    // The plaintext password never reaches the database.
    const updateData = prisma.user.update.mock.calls[0][0].data;
    expect(JSON.stringify(updateData)).not.toContain('NewPassword123');
  });

  it('burns the token atomically before changing the password', async () => {
    const prisma = makePrisma();
    prisma.passwordResetToken.findUnique.mockResolvedValue(validTokenRow());
    const { service } = makeService(prisma);

    await service.resetPassword('raw-token', 'NewPassword123');

    expect(prisma.passwordResetToken.updateMany).toHaveBeenCalledWith({
      where: { id: 'prt1', usedAt: null },
      data: { usedAt: expect.any(Date) },
    });
    const burnOrder =
      prisma.passwordResetToken.updateMany.mock.invocationCallOrder[0];
    const updateOrder = prisma.user.update.mock.invocationCallOrder[0];
    expect(burnOrder).toBeLessThan(updateOrder);
  });

  it('rejects when the token was consumed concurrently', async () => {
    const prisma = makePrisma();
    prisma.passwordResetToken.findUnique.mockResolvedValue(validTokenRow());
    prisma.passwordResetToken.updateMany.mockResolvedValue({ count: 0 });
    const { service, tokens } = makeService(prisma);

    await expect(
      service.resetPassword('raw-token', 'NewPassword123'),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(tokens.revokeAllForUser).not.toHaveBeenCalled();
  });

  it('revokes all refresh tokens after the password change', async () => {
    const prisma = makePrisma();
    prisma.passwordResetToken.findUnique.mockResolvedValue(validTokenRow());
    const { service, tokens } = makeService(prisma);

    await service.resetPassword('raw-token', 'NewPassword123');

    expect(tokens.revokeAllForUser).toHaveBeenCalledWith('u1');
  });
});
