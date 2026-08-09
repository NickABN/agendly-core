/**
 * Slugs that can never be assigned to a tenant. The public booking page lives
 * at `/[slug]`, so any single-segment application route (frontend page or
 * backend resource root) must be reserved — otherwise a tenant slug like
 * `admin` would shadow the app route and the auth middleware would treat it
 * as a public booking page.
 *
 * Single source of truth shared by the frontend route classification and the
 * backend slug validation (registration and tenant updates).
 */
export const RESERVED_SLUGS = [
  'admin',
  'api',
  'appointments',
  'arco',
  'auth',
  'availability',
  'billing',
  'employees',
  'forgot-password',
  'health',
  'login',
  'onboarding',
  'privacidad',
  'profile',
  'public',
  'register',
  'reset-password',
  'schedules',
  'services',
  'tenant',
] as const;

export type ReservedSlug = (typeof RESERVED_SLUGS)[number];

const RESERVED_SLUG_SET: ReadonlySet<string> = new Set(RESERVED_SLUGS);

/** Case-insensitive check against the reserved slug list. */
export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUG_SET.has(slug.toLowerCase());
}
