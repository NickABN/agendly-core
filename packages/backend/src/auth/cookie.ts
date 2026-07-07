import type { CookieOptions } from 'express';
import { parseDurationMs } from './duration';

/** Cookie de acceso (JWT httpOnly, corta ~15 min). */
export const AUTH_COOKIE = 'agendly_token';
/** Cookie de refresh (opaca, larga, revocable). Solo viaja a rutas /auth. */
export const REFRESH_COOKIE = 'agendly_refresh';

const DEFAULT_ACCESS_TTL = '15m';
const DEFAULT_REFRESH_TTL = '7d';

/** Flags comunes: httpOnly + secure/sameSite según entorno. */
function baseOptions(): Omit<CookieOptions, 'maxAge' | 'path'> {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProd,
    // 'none' en prod: cross-site Netlify→Render (solo HTTPS). 'lax' en local.
    // Ver SECURITY.md para el plan de mismo dominio registrable → 'lax' en prod.
    sameSite: isProd ? 'none' : 'lax',
  };
}

/**
 * Cookie de sesión (access token). httpOnly → invisible a JS (mitiga XSS).
 * maxAge alineado al TTL del JWT: cuando caduca, el request va sin cookie → 401 →
 * el frontend dispara el refresh automático.
 */
export function authCookieOptions(): CookieOptions {
  const ttl = process.env.ACCESS_TOKEN_TTL ?? DEFAULT_ACCESS_TTL;
  return {
    ...baseOptions(),
    maxAge: parseDurationMs(ttl),
    path: '/',
  };
}

/**
 * Cookie del refresh token. `path: '/auth'` la restringe a las rutas de auth
 * (menor superficie: no viaja en cada request de la API). En SSR se reenvía igual
 * porque `useRequestHeaders(['cookie'])` manda el header Cookie completo.
 */
export function refreshCookieOptions(): CookieOptions {
  const ttl = process.env.REFRESH_TOKEN_TTL ?? DEFAULT_REFRESH_TTL;
  return {
    ...baseOptions(),
    maxAge: parseDurationMs(ttl),
    path: '/auth',
  };
}
