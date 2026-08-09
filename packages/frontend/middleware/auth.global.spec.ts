import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(resolve(__dirname, 'auth.global.ts'), 'utf-8');

describe('auth.global.ts public-route gating', () => {
  it('delegates public-route classification to the shared helper', () => {
    expect(source).toContain('if (isPublicRoutePath(to.path)) return;');
  });

  it('no longer classifies any single lowercase segment as a public booking page', () => {
    // The raw slug regex treated /admin and /onboarding as public booking pages,
    // bypassing auth, onboarding, and subscription gating.
    expect(source).not.toContain('to.path.match(/^\\/[a-z0-9-]+$/)');
  });
});
