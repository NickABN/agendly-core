import {
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { TokenService } from './token.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

/** Coste bcrypt: 12 rondas (recomendado actual; 10 era el mínimo aceptable). */
const BCRYPT_ROUNDS = 12;

@Injectable()
export class AuthService {
  // Audit log de eventos de auth (OWASP A09). El logger de request (pino, Fase O)
  // adjunta IP + requestId automáticamente a cada línea.
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly tokenService: TokenService,
  ) {}

  async register(dto: RegisterDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictException('Ya existe una cuenta con este email');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const slug = this.generateSlug(dto.businessName);
    const tenantId = randomUUID();
    const uniqueSlug = await this.ensureUniqueSlug(this.prisma, slug);

    const [tenant, user] = await this.prisma.$transaction([
      this.prisma.tenant.create({
        data: {
          id: tenantId,
          name: dto.businessName,
          slug: uniqueSlug,
          trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days
        },
      }),
      this.prisma.user.create({
        data: {
          tenantId,
          email: dto.email,
          passwordHash,
          name: dto.ownerName,
          role: 'OWNER',
        },
      }),
    ]);

    this.logger.log(`Registro exitoso: ${dto.email}`);
    return this.buildAuthResponse(user, tenant.id);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user || !user.passwordHash) {
      this.logger.warn(`Login fallido (usuario inexistente): ${dto.email}`);
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const isPasswordValid = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );
    if (!isPasswordValid) {
      this.logger.warn(`Login fallido (contraseña incorrecta): ${dto.email}`);
      throw new UnauthorizedException('Credenciales inválidas');
    }

    if (!user.isActive) {
      this.logger.warn(`Login rechazado (cuenta desactivada): ${dto.email}`);
      throw new UnauthorizedException('Cuenta desactivada');
    }

    this.logger.log(`Login exitoso: ${dto.email}`);
    return this.buildAuthResponse(user, user.tenantId);
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { tenant: true },
    });

    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      tenantId: user.tenantId,
      tenant: {
        id: user.tenant.id,
        name: user.tenant.name,
        slug: user.tenant.slug,
        onboardedAt: user.tenant.onboardedAt?.toISOString() ?? null,
        trialEndsAt: user.tenant.trialEndsAt.toISOString(),
        isActive: user.tenant.isActive,
        subscriptionStatus: user.tenant.subscriptionStatus,
        currentPeriodEnd: user.tenant.currentPeriodEnd?.toISOString() ?? null,
      },
    };
  }

  async findOrCreateGoogleUser(profile: {
    googleId: string;
    email: string;
    name: string;
  }) {
    let user = await this.prisma.user.findUnique({
      where: { googleId: profile.googleId },
    });

    if (user) {
      return this.buildAuthResponse(user, user.tenantId);
    }

    // Check if email already exists (link accounts)
    user = await this.prisma.user.findUnique({
      where: { email: profile.email },
    });

    if (user) {
      // Link Google to existing account
      await this.prisma.user.update({
        where: { id: user.id },
        data: { googleId: profile.googleId },
      });
      return this.buildAuthResponse(user, user.tenantId);
    }

    // New user — create tenant + user
    const slug = this.generateSlug(profile.name);
    const tenantId = randomUUID();
    const uniqueSlug = await this.ensureUniqueSlug(this.prisma, slug);

    const [tenant, newUser] = await this.prisma.$transaction([
      this.prisma.tenant.create({
        data: {
          id: tenantId,
          name: profile.name,
          slug: uniqueSlug,
          trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        },
      }),
      this.prisma.user.create({
        data: {
          tenantId,
          email: profile.email,
          name: profile.name,
          googleId: profile.googleId,
          role: 'OWNER',
        },
      }),
    ]);

    return this.buildAuthResponse(newUser, tenant.id);
  }

  private async buildAuthResponse(
    user: { id: string; email: string; name: string; role: string },
    tenantId: string,
  ) {
    const payload = { sub: user.id, tenantId, role: user.role };
    // El refresh se emite fuera de la $transaction de creación (el user.id ya existe).
    const refreshToken = await this.tokenService.issueRefreshToken(user.id);
    return {
      accessToken: this.jwtService.sign(payload),
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenantId,
      },
    };
  }

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  private async ensureUniqueSlug(
    prisma: PrismaService,
    baseSlug: string,
  ): Promise<string> {
    let slug = baseSlug;
    let counter = 1;
    while (await prisma.tenant.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }
    return slug;
  }
}
