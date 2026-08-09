import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { TokenService } from './token.service';
import { EmailService } from '../email/email.service';

/** Same bcrypt cost as register (see auth.service.ts). */
const BCRYPT_ROUNDS = 12;
/** Reset links are valid for 30 minutes. */
const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;

const INVALID_TOKEN_MESSAGE =
  'El enlace de recuperación es inválido o ha expirado';

/** "ana@gmail.com" → "a***@gmail.com" — never log full PII (same as email.service.ts). */
function maskEmail(email: string): string {
  const [user, domain] = email.split('@');
  if (!domain) return '***';
  return `${user.slice(0, 1)}***@${domain}`;
}

/**
 * Password reset flow (house token pattern, see token.service.ts): the raw token
 * travels only in the email link; the DB stores its SHA-256, so a table dump cannot
 * forge reset links. Tokens are single-use with a 30 minute TTL, and a successful
 * reset revokes every refresh token of the user (all sessions closed).
 */
@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly tokenService: TokenService,
    private readonly emailService: EmailService,
  ) {}

  /**
   * Anti-enumeration: always resolves the same way regardless of whether the email
   * exists. Google-only accounts (no password hash) are silently skipped — there is
   * no password to reset.
   */
  async requestReset(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user || !user.passwordHash) {
      // Same observable outcome as the happy path (generic 200 upstream).
      this.logger.log(`Solicitud de reset ignorada: ${maskEmail(email)}`);
      return;
    }

    // Only the newest link works: invalidate previous unused tokens first.
    await this.prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    const rawToken = randomBytes(32).toString('hex');
    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: this.hashHex(rawToken),
        expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
      },
    });

    // FRONTEND_URL is the admin app (where /login and /reset-password live);
    // PUBLIC_APP_URL is the customer-facing booking app — wrong audience here.
    const resetUrl = `${this.frontendUrl()}/reset-password?token=${rawToken}`;
    await this.emailService.sendPasswordReset(user.email, resetUrl);

    // The raw token is never logged.
    this.logger.log(`Email de reset enviado: ${maskEmail(user.email)}`);
  }

  /** Validates the token (exists, unused, unexpired), rotates the password hash. */
  async resetPassword(token: string, password: string): Promise<void> {
    const row = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash: this.hashHex(token) },
    });

    const now = new Date();
    if (!row || row.usedAt || row.expiresAt.getTime() <= now.getTime()) {
      throw new BadRequestException(INVALID_TOKEN_MESSAGE);
    }

    // Burn the token atomically BEFORE touching the password: concurrent submits of
    // the same link see count 0 and fail — single-use even under races.
    const consumed = await this.prisma.passwordResetToken.updateMany({
      where: { id: row.id, usedAt: null },
      data: { usedAt: now },
    });
    if (consumed.count !== 1) {
      throw new BadRequestException(INVALID_TOKEN_MESSAGE);
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    await this.prisma.user.update({
      where: { id: row.userId },
      data: { passwordHash },
    });

    // Password changed → close every open session (stolen refresh tokens die here).
    await this.tokenService.revokeAllForUser(row.userId);
    this.logger.log(`Contraseña restablecida (userId=${row.userId})`);
  }

  private frontendUrl(): string {
    return (
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3001'
    ).replace(/\/+$/, '');
  }

  private hashHex(input: string): string {
    return createHash('sha256').update(input).digest('hex');
  }
}
