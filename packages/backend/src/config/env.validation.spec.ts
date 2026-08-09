import 'reflect-metadata';
import { validate } from './env.validation';

const BASE = { DATABASE_URL: 'postgresql://user:pass@host/db' };
const STRONG = 'local-dev-a1b2c3d4e5f60718293a4b5c6d7e8f90';

describe('env.validation — JWT_SECRET (OWASP A05)', () => {
  it('rejects the known insecure default', () => {
    expect(() =>
      validate({ ...BASE, JWT_SECRET: 'dev-only-insecure-secret-change-me' }),
    ).toThrow();
  });

  it('rejects secrets shorter than 32 chars', () => {
    expect(() => validate({ ...BASE, JWT_SECRET: 'too-short' })).toThrow();
  });

  it('rejects a missing JWT_SECRET', () => {
    expect(() => validate({ ...BASE })).toThrow();
  });

  it('accepts a strong 32+ char secret', () => {
    expect(() => validate({ ...BASE, JWT_SECRET: STRONG })).not.toThrow();
  });
});

describe('env.validation — NODE_ENV', () => {
  it.each(['development', 'production', 'test'])(
    'accepts NODE_ENV=%s',
    (env) => {
      expect(() =>
        validate({
          ...BASE,
          JWT_SECRET: STRONG,
          NODE_ENV: env,
          FRONTEND_URL: 'https://app.agendly.mx',
          PUBLIC_APP_URL: 'https://agendly-admin1.netlify.app',
        }),
      ).not.toThrow();
    },
  );

  it('accepts an unset NODE_ENV (local dev default)', () => {
    expect(() => validate({ ...BASE, JWT_SECRET: STRONG })).not.toThrow();
  });

  it('rejects a miscased NODE_ENV like "Production"', () => {
    expect(() =>
      validate({ ...BASE, JWT_SECRET: STRONG, NODE_ENV: 'Production' }),
    ).toThrow(/NODE_ENV/);
  });

  it('rejects an unknown NODE_ENV like "staging"', () => {
    expect(() =>
      validate({ ...BASE, JWT_SECRET: STRONG, NODE_ENV: 'staging' }),
    ).toThrow(/NODE_ENV/);
  });
});

describe('env.validation — removed variables', () => {
  it('ignores the deprecated JWT_EXPIRATION without failing', () => {
    expect(() =>
      validate({ ...BASE, JWT_SECRET: STRONG, JWT_EXPIRATION: '7d' }),
    ).not.toThrow();
  });
});

describe('env.validation — FRONTEND_URL in production', () => {
  it('requires FRONTEND_URL when NODE_ENV=production', () => {
    expect(() =>
      validate({
        ...BASE,
        JWT_SECRET: STRONG,
        NODE_ENV: 'production',
        PUBLIC_APP_URL: 'https://agendly-admin1.netlify.app',
      }),
    ).toThrow('FRONTEND_URL is required');
  });

  it('rejects localhost FRONTEND_URL when NODE_ENV=production', () => {
    expect(() =>
      validate({
        ...BASE,
        JWT_SECRET: STRONG,
        NODE_ENV: 'production',
        FRONTEND_URL: 'http://localhost:3001',
        PUBLIC_APP_URL: 'https://agendly-admin1.netlify.app',
      }),
    ).toThrow('FRONTEND_URL cannot point to localhost');
  });

  it('allows localhost FRONTEND_URL for explicit local Docker compose production runtime', () => {
    expect(() =>
      validate({
        ...BASE,
        JWT_SECRET: STRONG,
        NODE_ENV: 'production',
        AGENDLY_LOCAL_DOCKER: 'true',
        FRONTEND_URL: 'http://localhost:3001',
        PUBLIC_APP_URL: 'http://localhost:3001',
      }),
    ).not.toThrow();
  });

  it('rejects localhost FRONTEND_URL on Render even when local Docker flag is set', () => {
    expect(() =>
      validate({
        ...BASE,
        JWT_SECRET: STRONG,
        NODE_ENV: 'production',
        AGENDLY_LOCAL_DOCKER: 'true',
        RENDER: 'true',
        FRONTEND_URL: 'http://localhost:3001',
        PUBLIC_APP_URL: 'https://agendly-admin1.netlify.app',
      }),
    ).toThrow('FRONTEND_URL cannot point to localhost');
  });

  it('rejects non-https public FRONTEND_URL when NODE_ENV=production', () => {
    expect(() =>
      validate({
        ...BASE,
        JWT_SECRET: STRONG,
        NODE_ENV: 'production',
        FRONTEND_URL: 'http://app.agendly.mx',
        PUBLIC_APP_URL: 'https://agendly-admin1.netlify.app',
      }),
    ).toThrow('FRONTEND_URL must use https');
  });

  it('accepts a public FRONTEND_URL when NODE_ENV=production', () => {
    expect(() =>
      validate({
        ...BASE,
        JWT_SECRET: STRONG,
        NODE_ENV: 'production',
        FRONTEND_URL: 'https://app.agendly.mx',
        PUBLIC_APP_URL: 'https://agendly-admin1.netlify.app',
      }),
    ).not.toThrow();
  });

  it('keeps local development usable without FRONTEND_URL', () => {
    expect(() =>
      validate({ ...BASE, JWT_SECRET: STRONG, NODE_ENV: 'development' }),
    ).not.toThrow();
  });
});

describe('env.validation — PUBLIC_APP_URL in production', () => {
  it('requires PUBLIC_APP_URL when NODE_ENV=production', () => {
    expect(() =>
      validate({
        ...BASE,
        JWT_SECRET: STRONG,
        NODE_ENV: 'production',
        FRONTEND_URL: 'https://app.agendly.mx',
      }),
    ).toThrow('PUBLIC_APP_URL is required');
  });

  it('rejects localhost PUBLIC_APP_URL when NODE_ENV=production', () => {
    expect(() =>
      validate({
        ...BASE,
        JWT_SECRET: STRONG,
        NODE_ENV: 'production',
        FRONTEND_URL: 'https://app.agendly.mx',
        PUBLIC_APP_URL: 'http://localhost:3001',
      }),
    ).toThrow('PUBLIC_APP_URL cannot point to localhost');
  });

  it('accepts localhost PUBLIC_APP_URL for explicit local Docker compose production runtime', () => {
    expect(() =>
      validate({
        ...BASE,
        JWT_SECRET: STRONG,
        NODE_ENV: 'production',
        AGENDLY_LOCAL_DOCKER: 'true',
        FRONTEND_URL: 'http://localhost:3001',
        PUBLIC_APP_URL: 'http://localhost:3001',
      }),
    ).not.toThrow();
  });

  it('rejects non-https public PUBLIC_APP_URL when NODE_ENV=production', () => {
    expect(() =>
      validate({
        ...BASE,
        JWT_SECRET: STRONG,
        NODE_ENV: 'production',
        FRONTEND_URL: 'https://app.agendly.mx',
        PUBLIC_APP_URL: 'http://agendly-admin1.netlify.app',
      }),
    ).toThrow('PUBLIC_APP_URL must use https');
  });

  it('accepts a public PUBLIC_APP_URL when NODE_ENV=production', () => {
    expect(() =>
      validate({
        ...BASE,
        JWT_SECRET: STRONG,
        NODE_ENV: 'production',
        FRONTEND_URL: 'https://app.agendly.mx',
        PUBLIC_APP_URL: 'https://agendly-admin1.netlify.app',
      }),
    ).not.toThrow();
  });
});
