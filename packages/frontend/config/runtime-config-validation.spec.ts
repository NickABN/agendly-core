import { describe, expect, it } from 'vitest';
import {
  validateApiProxyTarget,
  validateNetlifyProxyConfig,
  validateProductionPublicApiUrl,
  validateProductionPublicAppUrl,
} from './runtime-config-validation';

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

describe('runtime-config-validation — NUXT_PUBLIC_APP_URL in production', () => {
  it('requires the app URL for hosted production runtime', () => {
    expect(() => validateProductionPublicAppUrl(undefined)).toThrow(
      'NUXT_PUBLIC_APP_URL is required in production runtime/deploys',
    );
  });

  it('rejects localhost app URLs for hosted production runtime', () => {
    expect(() => validateProductionPublicAppUrl('http://localhost:3001')).toThrow(
      'NUXT_PUBLIC_APP_URL cannot point to localhost',
    );
  });

  it('allows localhost app URLs for explicit local Docker compose production runtime', () => {
    expect(() =>
      validateProductionPublicAppUrl('http://localhost:3001', {
        NODE_ENV: 'production',
        AGENDLY_LOCAL_DOCKER: 'true',
      }),
    ).not.toThrow();
  });

  it('does not allow the local Docker flag to bypass Netlify production deploy validation', () => {
    expect(() =>
      validateProductionPublicAppUrl('http://localhost:3001', {
        NODE_ENV: 'production',
        NETLIFY: 'true',
        CONTEXT: 'production',
        AGENDLY_LOCAL_DOCKER: 'true',
      }),
    ).toThrow('NUXT_PUBLIC_APP_URL cannot point to localhost');
  });

  it('rejects non-https public app URLs for hosted production runtime', () => {
    expect(() => validateProductionPublicAppUrl('http://agendly-admin1.netlify.app')).toThrow(
      'NUXT_PUBLIC_APP_URL must use https',
    );
  });

  it('accepts https public app URLs for hosted production runtime', () => {
    expect(() =>
      validateProductionPublicAppUrl('https://agendly-admin1.netlify.app'),
    ).not.toThrow();
  });
});

describe('runtime-config-validation — Netlify API proxy', () => {
  it('requires the same-origin public API prefix', () => {
    expect(() =>
      validateNetlifyProxyConfig(
        'https://agendly-backend-u9tt.onrender.com',
        'https://agendly-backend-u9tt.onrender.com',
        '',
      ),
    ).toThrow('NUXT_PUBLIC_API_URL must be /api');
  });

  it('requires a private upstream', () => {
    expect(() => validateNetlifyProxyConfig('/api', undefined, '')).toThrow(
      'NUXT_API_PROXY_TARGET is required',
    );
  });

  it.each([
    'http://agendly-backend-u9tt.onrender.com',
    'https://example.com',
    'https://agendly-backend-u9tt.onrender.com/backend',
    'https://user:password@agendly-backend-u9tt.onrender.com',
  ])('rejects invalid proxy target %s', (target) => {
    expect(() => validateApiProxyTarget(target)).toThrow();
  });

  it('accepts the fixed Render origin and rejects a competing SSR override', () => {
    const target = 'https://agendly-backend-u9tt.onrender.com';
    expect(validateApiProxyTarget(target).origin).toBe(target);
    expect(() => validateNetlifyProxyConfig('/api', target, target)).toThrow(
      'NUXT_API_URL_INTERNAL must not be set',
    );
  });
});
