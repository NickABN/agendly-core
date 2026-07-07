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

describe('env.validation — FRONTEND_URL in production', () => {
  it('requires FRONTEND_URL when NODE_ENV=production', () => {
    expect(() => validate({ ...BASE, JWT_SECRET: STRONG, NODE_ENV: 'production' })).toThrow(
      'FRONTEND_URL is required',
    );
  });

  it('rejects localhost FRONTEND_URL when NODE_ENV=production', () => {
    expect(() =>
      validate({
        ...BASE,
        JWT_SECRET: STRONG,
        NODE_ENV: 'production',
        FRONTEND_URL: 'http://localhost:3001',
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
      }),
    ).not.toThrow();
  });

  it('keeps local development usable without FRONTEND_URL', () => {
    expect(() => validate({ ...BASE, JWT_SECRET: STRONG, NODE_ENV: 'development' })).not.toThrow();
  });
});
