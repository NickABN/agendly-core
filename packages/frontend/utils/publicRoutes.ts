import { isReservedSlug } from '@agendly/shared';

/** Routes (by prefix) that never require authentication. */
const PUBLIC_ROUTE_PREFIXES = [
  '/login',
  '/register',
  '/auth/callback',
  '/privacidad',
  '/arco',
  '/forgot-password',
  '/reset-password',
];

/** Shape of a public booking page path: a single lowercase segment. */
const BOOKING_SLUG_PATH = /^\/[a-z0-9-]+$/;

/**
 * A path is public when it is the landing page, an explicit public route, or
 * a tenant booking page (`/[slug]`). Reserved slugs (e.g. `/admin`,
 * `/onboarding`) are app routes — never booking pages — so they must go
 * through the normal auth/onboarding/subscription gating.
 */
export function isPublicRoutePath(path: string): boolean {
  if (path === '/') return true;
  if (PUBLIC_ROUTE_PREFIXES.some((route) => path.startsWith(route))) return true;
  return BOOKING_SLUG_PATH.test(path) && !isReservedSlug(path.slice(1));
}
