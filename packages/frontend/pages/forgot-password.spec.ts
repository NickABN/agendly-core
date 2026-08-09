import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(resolve(__dirname, 'forgot-password.vue'), 'utf-8');

describe('forgot-password.vue backend wiring', () => {
  it('no longer posts to the nonexistent Nuxt server route', () => {
    expect(source).not.toContain('/api/auth/forgot-password');
  });

  it('posts to the real backend endpoint using the public API URL', () => {
    expect(source).toContain('useRuntimeConfig');
    expect(source).toMatch(/\$\{apiUrl\}\/auth\/forgot-password/);
  });

  it('keeps the always-success UX only when the request actually succeeded', () => {
    // Success is set in the try block, not unconditionally in finally.
    expect(source).toMatch(/submitted\.value = true[\s\S]*?\} catch/);
  });

  it('surfaces a generic retry message on network/server errors', () => {
    expect(source).toContain('No pudimos procesar tu solicitud');
  });
});
