// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('global pointer cursor styles', () => {
  it('sets pointer cursor for enabled buttons', () => {
    const stylesheet = readFileSync(resolve(process.cwd(), 'assets/css/main.css'), 'utf8');
    const matchingRule = [...stylesheet.matchAll(/([^{}]+)\{([^{}]*)\}/g)].find(([, selector]) =>
      selector?.includes('button:not(:disabled)'),
    );

    expect(matchingRule).toBeDefined();
    expect(matchingRule?.[2]).toMatch(/cursor:\s*pointer\s*;/);
  });
});
