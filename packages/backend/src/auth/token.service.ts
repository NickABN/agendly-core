import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { parseDurationMs } from './duration';

/** TTL deslizante por token (se renueva en cada rotación). */
const DEFAULT_REFRESH_TTL = '7d';
/** Tope absoluto de la familia (una sesión no vive más que esto desde el login). */
const DEFAULT_REFRESH_ABSOLUTE_TTL = '30d';

interface ParsedCookie {
  id: string;
  secret: string;
}

/**
 * Ciclo de vida de los refresh tokens: emisión, rotación con detección de reuso,
 * y revocación (lista de revocación server-side). Cierra OWASP A07-1.
 *
 * La cookie transporta `id.secret`. En la DB solo se guarda el SHA-256 del secreto,
 * así que un dump de la tabla no permite forjar tokens. El lookup es por `id`
 * (findUnique, sin table scan) y la verificación del secreto es en tiempo constante.
 */
@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /** Emite un refresh token nuevo (familia nueva). Devuelve el valor de la cookie. */
  async issueRefreshToken(userId: string): Promise<string> {
    const now = Date.now();
    const familyExpiresAt = new Date(now + this.absoluteTtlMs());
    const expiresAt = new Date(
      Math.min(now + this.slidingTtlMs(), familyExpiresAt.getTime()),
    );

    const id = randomUUID();
    const familyId = randomUUID();
    const secret = randomBytes(32).toString('base64url');

    await this.prisma.refreshToken.create({
      data: {
        id,
        userId,
        familyId,
        tokenHash: this.hashHex(secret),
        expiresAt,
        familyExpiresAt,
      },
    });

    return `${id}.${secret}`;
  }

  /**
   * Rota el refresh presentado: revoca el viejo, emite uno nuevo en la misma familia
   * y firma un access token fresco. Ante reuso de un token ya consumido → robo → se
   * revoca toda la familia. Devuelve el access token y el nuevo valor de cookie.
   */
  async rotate(
    cookieValue: string,
  ): Promise<{ accessToken: string; refreshCookieValue: string }> {
    // Limpieza best-effort de tokens expirados (barrido lazy).
    await this.cleanupExpired();

    const parsed = this.parseCookie(cookieValue);
    if (!parsed) throw new UnauthorizedException();

    const row = await this.prisma.refreshToken.findUnique({
      where: { id: parsed.id },
      include: { user: true },
    });
    if (!row) throw new UnauthorizedException();

    // Verificación del secreto en tiempo constante ANTES de mirar el estado: así
    // conocer solo el `id` (sin el secreto) no permite disparar revocaciones (DoS).
    if (!this.secretMatches(parsed.secret, row.tokenHash)) {
      this.logger.warn(`Refresh con secreto inválido (id=${parsed.id})`);
      throw new UnauthorizedException();
    }

    // Reuso: el secreto es correcto pero el token ya fue rotado → robo comprobado.
    if (row.revokedAt) {
      this.logger.warn(
        `Reuso de refresh detectado — revocando familia ${row.familyId}`,
      );
      await this.prisma.refreshToken.updateMany({
        where: { familyId: row.familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException();
    }

    const now = Date.now();
    if (
      row.expiresAt.getTime() <= now ||
      row.familyExpiresAt.getTime() <= now
    ) {
      throw new UnauthorizedException();
    }
    if (!row.user.isActive) throw new UnauthorizedException();

    // Consume el token actual atómicamente antes de emitir el sucesor. Sin el
    // update condicional, refreshes concurrentes pueden ver revokedAt=null y
    // crear múltiples sucesores válidos para el mismo token.
    const newId = randomUUID();
    const newSecret = randomBytes(32).toString('base64url');
    const newExpiresAt = new Date(
      Math.min(now + this.slidingTtlMs(), row.familyExpiresAt.getTime()),
    );
    const revokedAt = new Date();

    await this.prisma.$transaction(async (tx) => {
      const consumed = await tx.refreshToken.updateMany({
        where: { id: row.id, revokedAt: null },
        data: { revokedAt },
      });

      if (consumed.count !== 1) {
        throw new UnauthorizedException();
      }

      await tx.refreshToken.create({
        data: {
          id: newId,
          userId: row.userId,
          familyId: row.familyId,
          tokenHash: this.hashHex(newSecret),
          expiresAt: newExpiresAt,
          familyExpiresAt: row.familyExpiresAt,
        },
      });

      await tx.refreshToken.update({
        where: { id: row.id },
        data: { replacedByTokenId: newId },
      });
    });

    const accessToken = this.jwtService.sign({
      sub: row.user.id,
      tenantId: row.user.tenantId,
      role: row.user.role,
    });

    return { accessToken, refreshCookieValue: `${newId}.${newSecret}` };
  }

  /** Revoca el token presentado (y opcionalmente toda su familia). Idempotente. */
  async revoke(
    cookieValue: string | undefined,
    opts: { wholeFamily?: boolean } = {},
  ): Promise<void> {
    if (!cookieValue) return;
    const parsed = this.parseCookie(cookieValue);
    if (!parsed) return;

    const row = await this.prisma.refreshToken.findUnique({
      where: { id: parsed.id },
    });
    if (!row) return;

    const now = new Date();
    if (opts.wholeFamily) {
      await this.prisma.refreshToken.updateMany({
        where: { familyId: row.familyId, revokedAt: null },
        data: { revokedAt: now },
      });
    } else if (!row.revokedAt) {
      await this.prisma.refreshToken.update({
        where: { id: row.id },
        data: { revokedAt: now },
      });
    }
  }

  /** Revoca todas las sesiones del usuario (cerrar sesión en todos los dispositivos). */
  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** Poda tokens ya expirados (por token o por tope de familia). Best-effort. */
  private async cleanupExpired(): Promise<void> {
    try {
      const now = new Date();
      await this.prisma.refreshToken.deleteMany({
        where: {
          OR: [{ expiresAt: { lt: now } }, { familyExpiresAt: { lt: now } }],
        },
      });
    } catch (err) {
      this.logger.warn(`Limpieza de refresh tokens falló: ${String(err)}`);
    }
  }

  private slidingTtlMs(): number {
    return parseDurationMs(
      this.configService.get<string>('REFRESH_TOKEN_TTL', DEFAULT_REFRESH_TTL),
    );
  }

  private absoluteTtlMs(): number {
    return parseDurationMs(
      this.configService.get<string>(
        'REFRESH_ABSOLUTE_TTL',
        DEFAULT_REFRESH_ABSOLUTE_TTL,
      ),
    );
  }

  private hashHex(input: string): string {
    return createHash('sha256').update(input).digest('hex');
  }

  private secretMatches(secret: string, storedHash: string): boolean {
    const candidate = createHash('sha256').update(secret).digest();
    const stored = Buffer.from(storedHash, 'hex');
    if (candidate.length !== stored.length) return false;
    return timingSafeEqual(candidate, stored);
  }

  private parseCookie(value: string): ParsedCookie | null {
    const dot = value.indexOf('.');
    if (dot <= 0 || dot === value.length - 1) return null;
    return { id: value.slice(0, dot), secret: value.slice(dot + 1) };
  }
}
