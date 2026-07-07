import { describe, expect, it } from 'vitest';
import { validateProductionPublicApiUrl } from './runtime-config-validation';

describe('runtime-config-validation — NUXT_PUBLIC_API_URL in production', () => {
  it('rejects localhost API URLs for hosted production runtime', () => {
    expect(() => validateProductionPublicApiUrl('http://localhost:3000')).toThrow(
      'NUXT_PUBLIC_API_URL cannot point to localhost',
    );
  });

  it('allows localhost API URLs for explicit local Docker compose production runtime', () => {
    expect(() =>
      validateProductionPublicApiUrl('http://localhost:3000', {
        NODE_ENV: 'production',
        AGENDLY_LOCAL_DOCKER: 'true',
      }),
    ).not.toThrow();
  });

  it('does not allow the local Docker flag to bypass Netlify production deploy validation', () => {
    expect(() =>
      validateProductionPublicApiUrl('http://localhost:3000', {
        NODE_ENV: 'production',
        NETLIFY: 'true',
        CONTEXT: 'production',
        AGENDLY_LOCAL_DOCKER: 'true',
      }),
    ).toThrow('NUXT_PUBLIC_API_URL cannot point to localhost');
  });

  it('rejects non-https public API URLs for hosted production runtime', () => {
    expect(() => validateProductionPublicApiUrl('http://api.agendly.mx')).toThrow(
      'NUXT_PUBLIC_API_URL must use https',
    );
  });

  it('accepts https public API URLs for hosted production runtime', () => {
    expect(() => validateProductionPublicApiUrl('https://api.agendly.mx')).not.toThrow();
  });
});
