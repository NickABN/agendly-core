/**
 * Bug condition exploration test for profile.vue
 *
 * Property 1: Bug Condition — Ausencia de scroll interno en página de perfil
 *
 * On FIXED code this test PASSES — confirming the bug is resolved.
 * (On unfixed code it would FAIL — confirming the bug existed)
 *
 * Validates: Requirements 2.1, 2.2
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, it, expect } from 'vitest';

// ─── isBugCondition (static analysis variant) ─────────────────────────────────
// Mirrors the formal specification from design.md, operating on raw source text
// instead of a live DOM (since the test environment is node, no jsdom).
//
// FUNCTION isBugCondition(rootClassAttr, templateSource)
//   rootHasFixedHeight  := rootClassAttr CONTAINS 'h-full'
//   rootHidesOverflow   := rootClassAttr CONTAINS 'overflow-hidden'
//   contentScrollable   := templateSource CONTAINS 'overflow-y-auto'
//   RETURN rootHasFixedHeight AND rootHidesOverflow AND contentScrollable
// END FUNCTION

function extractRootDivClass(templateSource: string): string {
  // Match the first <div class="..."> in the <template> block
  const match = templateSource.match(/<template[^>]*>[\s\S]*?<div\s+class="([^"]+)"/);
  return match ? match[1] : '';
}

function isBugCondition(rootClassAttr: string, templateSource: string): boolean {
  const rootHasFixedHeight = rootClassAttr.split(/\s+/).includes('h-full');
  const rootHidesOverflow = rootClassAttr.split(/\s+/).includes('overflow-hidden');
  const contentScrollable = /\boverflow-y-auto\b/.test(templateSource);
  return rootHasFixedHeight && rootHidesOverflow && contentScrollable;
}

// ─── Test ──────────────────────────────────────────────────────────────────────

describe('profile.vue — Bug Condition: scroll interno (Property 1)', () => {
  const profilePath = resolve(__dirname, 'profile.vue');
  const source = readFileSync(profilePath, 'utf-8');

  // Extract only the <template> block to avoid false positives in comments/scripts
  const templateMatch = source.match(/<template>([\s\S]*)<\/template>/);
  const templateSource = templateMatch ? templateMatch[1] : source;

  const rootClass = extractRootDivClass(source);

  it('root div does NOT contain h-full (no fixed-height context)', () => {
    expect(rootClass.split(/\s+/)).not.toContain('h-full');
  });

  it('root div does NOT contain overflow-hidden (no clipped scroll context)', () => {
    expect(rootClass.split(/\s+/)).not.toContain('overflow-hidden');
  });

  it('no element in the template has class overflow-y-auto (no internal scrollbar)', () => {
    expect(/\boverflow-y-auto\b/.test(templateSource)).toBe(false);
  });

  it('isBugCondition returns false on fixed code', () => {
    expect(isBugCondition(rootClass, templateSource)).toBe(false);
  });
});
