import type { CookieOptions } from 'express';

/** Nombre de la cookie de sesión (JWT httpOnly). */
export const AUTH_COOKIE = 'agendly_token';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Opciones de la cookie de sesión.
 * - httpOnly: no accesible por JS (mitiga robo por XSS).
 * - secure + sameSite='none' en prod: la cookie viaja en requests cross-site
 *   (frontend Netlify → backend Render son dominios distintos) solo sobre HTTPS.
 * - sameSite='lax' en local (mismo host localhost, distinto puerto = same-site).
 *
 * Nota: para producción "de verdad" conviene desplegar frontend y backend bajo
 * el mismo dominio registrable (app.agendly.mx / api.agendly.mx) → sameSite='lax'
 * y sin cookies de terceros. Ver SECURITY.md.
 */
export function authCookieOptions(): CookieOptions {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    maxAge: SEVEN_DAYS_MS,
    path: '/',
  };
}
