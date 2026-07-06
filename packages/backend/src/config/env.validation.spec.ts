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
