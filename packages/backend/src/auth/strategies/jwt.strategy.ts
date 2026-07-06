import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';
import { AUTH_COOKIE } from '../cookie';

export interface JwtPayload {
  sub: string;
  tenantId: string;
  role: string;
}

/** Lee el JWT de la cookie httpOnly (navegador) o del header Bearer (API/tests). */
function extractJwt(req: Request): string | null {
  const cookies = (req.cookies ?? {}) as Record<string, string>;
  const fromCookie = cookies[AUTH_COOKIE];
  if (fromCookie) return fromCookie;
  return ExtractJwt.fromAuthHeaderAsBearerToken()(req);
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    const secretOrKey = configService.get<string>('JWT_SECRET')!;
    super({
      jwtFromRequest: extractJwt,
      ignoreExpiration: false,
      secretOrKey,
    });
  }

  validate(payload: JwtPayload) {
    return {
      userId: payload.sub,
      tenantId: payload.tenantId,
      role: payload.role,
    };
  }
}
