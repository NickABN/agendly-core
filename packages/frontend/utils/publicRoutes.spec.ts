import { describe, expect, it } from 'vitest';
import { isPublicRoutePath } from './publicRoutes';

describe('isPublicRoutePath', () => {
  it('treats the landing page as public', () => {
    expect(isPublicRoutePath('/')).toBe(true);
  });

  it.each([
    '/login',
    '/register',
    '/auth/callback',
    '/privacidad',
    '/arco',
    '/forgot-password',
    '/reset-password',
  ])('treats the explicit public route "%s" as public', (path) => {
    expect(isPublicRoutePath(path)).toBe(true);
  });

  it.each(['/mi-salon', '/salon-calma', '/barberia-2'])(
    'treats the booking slug page "%s" as public',
    (path) => {
      expect(isPublicRoutePath(path)).toBe(true);
    },
  );

  it.each(['/admin', '/onboarding'])(
    'does NOT treat the reserved app route "%s" as a public booking page',
    (path) => {
      expect(isPublicRoutePath(path)).toBe(false);
    },
  );

  it('does not treat nested admin routes as public', () => {
    expect(isPublicRoutePath('/admin/subscription')).toBe(false);
    expect(isPublicRoutePath('/admin/settings/profile')).toBe(false);
  });

  it('does not treat non-slug paths as public', () => {
    expect(isPublicRoutePath('/Mi-Salon')).toBe(false);
    expect(isPublicRoutePath('/mi-salon/extra')).toBe(false);
  });
});
