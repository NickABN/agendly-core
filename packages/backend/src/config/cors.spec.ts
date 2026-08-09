import { buildCorsAllowlist } from './cors';

describe('buildCorsAllowlist', () => {
  it('falls back to the local frontend origin when nothing is set', () => {
    expect(buildCorsAllowlist({})).toEqual(['http://localhost:3001']);
  });

  it('includes both FRONTEND_URL and PUBLIC_APP_URL when they differ', () => {
    expect(
      buildCorsAllowlist({
        FRONTEND_URL: 'https://app.agendly.mx',
        PUBLIC_APP_URL: 'https://agendly-admin1.netlify.app',
      }),
    ).toEqual(['https://app.agendly.mx', 'https://agendly-admin1.netlify.app']);
  });

  it('dedupes identical origins', () => {
    expect(
      buildCorsAllowlist({
        FRONTEND_URL: 'https://app.agendly.mx',
        PUBLIC_APP_URL: 'https://app.agendly.mx',
      }),
    ).toEqual(['https://app.agendly.mx']);
  });

  it('normalizes URLs with a path down to their origin (CORS matches origins)', () => {
    expect(
      buildCorsAllowlist({
        FRONTEND_URL: 'https://app.agendly.mx/admin/',
        PUBLIC_APP_URL: 'https://app.agendly.mx/booking',
      }),
    ).toEqual(['https://app.agendly.mx']);
  });

  it('drops unset vars and keeps the one that is set', () => {
    expect(
      buildCorsAllowlist({
        PUBLIC_APP_URL: 'https://agendly-admin1.netlify.app',
      }),
    ).toEqual(['https://agendly-admin1.netlify.app']);
  });

  it('ignores empty and whitespace-only values', () => {
    expect(
      buildCorsAllowlist({
        FRONTEND_URL: '  ',
        PUBLIC_APP_URL: 'https://app.agendly.mx',
      }),
    ).toEqual(['https://app.agendly.mx']);
  });

  it('skips values that are not valid URLs', () => {
    expect(
      buildCorsAllowlist({
        FRONTEND_URL: 'not-a-url',
        PUBLIC_APP_URL: 'https://app.agendly.mx',
      }),
    ).toEqual(['https://app.agendly.mx']);
  });

  it('falls back to the local frontend origin when every value is invalid', () => {
    expect(
      buildCorsAllowlist({ FRONTEND_URL: 'not-a-url', PUBLIC_APP_URL: '' }),
    ).toEqual(['http://localhost:3001']);
  });
});
