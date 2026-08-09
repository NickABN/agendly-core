import { describe, expect, it } from 'vitest';
import { RESERVED_SLUGS, isReservedSlug } from './reserved-slugs';

describe('isReservedSlug', () => {
  it.each([
    'admin',
    'login',
    'register',
    'onboarding',
    'auth',
    'privacidad',
    'arco',
    'forgot-password',
    'reset-password',
    'api',
    'health',
    'billing',
    'public',
  ])('reserves the app route "%s"', (slug) => {
    expect(isReservedSlug(slug)).toBe(true);
  });

  it.each([
    'tenant',
    'services',
    'employees',
    'schedules',
    'appointments',
    'availability',
    'profile',
  ])('reserves the backend resource root "%s"', (slug) => {
    expect(isReservedSlug(slug)).toBe(true);
  });

  it('is case-insensitive so casing tricks cannot bypass the check', () => {
    expect(isReservedSlug('Admin')).toBe(true);
    expect(isReservedSlug('ONBOARDING')).toBe(true);
  });

  it.each(['mi-salon', 'salon-calma', 'admin-beauty', 'adminx', 'la-privacidad'])(
    'allows the regular business slug "%s"',
    (slug) => {
      expect(isReservedSlug(slug)).toBe(false);
    },
  );

  it('keeps every reserved entry in valid slug shape (lowercase, digits, hyphens)', () => {
    for (const slug of RESERVED_SLUGS) {
      expect(slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    }
  });
});
