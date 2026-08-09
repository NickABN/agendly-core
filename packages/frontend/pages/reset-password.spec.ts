import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(resolve(__dirname, 'reset-password.vue'), 'utf-8');

describe('reset-password.vue', () => {
  it('reads the token from the route query', () => {
    expect(source).toContain('route.query.token');
  });

  it('submits the new password to the backend reset endpoint', () => {
    expect(source).toContain('/auth/reset-password');
    expect(source).not.toContain('/api/auth/reset-password');
  });

  it('validates the password confirmation before submitting', () => {
    expect(source).toContain('Las contraseñas no coinciden');
  });

  it('enforces the same minimum length as register (8 chars)', () => {
    expect(source).toContain('minlength="8"');
  });

  it('links back to login after a successful reset', () => {
    expect(source).toContain('to="/login"');
  });

  it('offers requesting a new link when the token is invalid, expired or missing', () => {
    expect(source).toContain('to="/forgot-password"');
  });

  it('surfaces the backend Spanish message on a 400', () => {
    expect(source).toContain('err.data?.message');
  });
});
