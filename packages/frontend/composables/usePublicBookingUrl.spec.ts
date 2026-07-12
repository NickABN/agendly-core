import { describe, expect, it } from 'vitest';
import {
  buildPublicBookingUrl,
  formatPublicAppUrlForDisplay,
  formatPublicBookingUrl,
  normalizePublicAppUrl,
} from './usePublicBookingUrl';

describe('usePublicBookingUrl helpers', () => {
  it('normalizes a trailing slash from the public app URL', () => {
    expect(normalizePublicAppUrl('https://agendly-admin1.netlify.app/')).toBe(
      'https://agendly-admin1.netlify.app',
    );
  });

  it('formats the public app URL for display without the protocol', () => {
    expect(
      formatPublicAppUrlForDisplay('https://agendly-admin1.netlify.app/'),
    ).toBe('agendly-admin1.netlify.app');
  });

  it('builds a full public booking URL from the configured app URL and slug', () => {
    expect(
      buildPublicBookingUrl('https://agendly-admin1.netlify.app/', 'salon-calma'),
    ).toBe('https://agendly-admin1.netlify.app/salon-calma');
  });

  it('formats a public booking URL for display without the protocol', () => {
    expect(
      formatPublicBookingUrl('https://agendly-admin1.netlify.app/', 'salon-calma'),
    ).toBe('agendly-admin1.netlify.app/salon-calma');
  });

  it('returns an empty string when no slug is available', () => {
    expect(buildPublicBookingUrl('https://agendly-admin1.netlify.app', '')).toBe('');
    expect(formatPublicBookingUrl('https://agendly-admin1.netlify.app', undefined)).toBe('');
  });
});
