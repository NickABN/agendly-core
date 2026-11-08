import { describe, expect, it } from 'vitest';
import { formatMxPhone, normalizeMxPhone } from './phone';

const CANONICAL = '+525512345678';

describe('normalizeMxPhone', () => {
  it.each([
    // 10 national digits, with every separator style we accept
    ['5512345678', CANONICAL],
    ['55 1234 5678', CANONICAL],
    ['55-1234-5678', CANONICAL],
    ['55.1234.5678', CANONICAL],
    ['(55) 1234 5678', CANONICAL],
    // 52 + 10 digits (country code without plus)
    ['525512345678', CANONICAL],
    ['52 55 1234 5678', CANONICAL],
    // +52 + 10 digits (already close to canonical)
    ['+525512345678', CANONICAL],
    ['+52 55 1234 5678', CANONICAL],
    // legacy mobile 1-prefix: 521 / +521 + 10 digits (drop the 1)
    ['5215512345678', CANONICAL],
    ['+5215512345678', CANONICAL],
    ['+521 55 1234 5678', CANONICAL],
    // legacy long-distance prefixes 044 / 045 + 10 digits (drop prefix)
    ['0445512345678', CANONICAL],
    ['0455512345678', CANONICAL],
    ['044 55 1234 5678', CANONICAL],
  ])('normalizes %s to %s', (input, expected) => {
    expect(normalizeMxPhone(input)).toBe(expected);
  });

  it('already-normalized input is returned unchanged (idempotence base case)', () => {
    expect(normalizeMxPhone(CANONICAL)).toBe(CANONICAL);
  });

  it.each(['5512345678', '55 1234 5678', '+52 55 1234 5678', '5215512345678', '0445512345678'])(
    'is idempotent for %s: normalize(normalize(x)) === normalize(x)',
    (input) => {
      const once = normalizeMxPhone(input);
      expect(once).not.toBeNull();
      expect(normalizeMxPhone(once as string)).toBe(once);
    },
  );

  it.each([
    ['empty string', ''],
    ['only separators', '()- .'],
    ['letters', 'abcdefghij'],
    ['mixed letters', '55 1234 ABCD'],
    ['too short (9 digits)', '551234567'],
    ['too long (11 national digits)', '55123456789'],
    ['wrong country code (+1 US)', '+15512345678'],
    ['wrong country code (13 digits not 521)', '5305512345678'],
    ['52 + 9 digits', '52551234567'],
    ['bare 1 + 10 digits (not 521)', '15512345678'],
    ['044 + 9 digits', '044551234567'],
    ['plus without digits', '+'],
  ])('rejects %s -> null', (_label, input) => {
    expect(normalizeMxPhone(input)).toBeNull();
  });
});

describe('formatMxPhone', () => {
  it('formats a normalized value as +52 55 1234 5678', () => {
    expect(formatMxPhone(CANONICAL)).toBe('+52 55 1234 5678');
  });

  it('returns input unchanged when it is not a normalized MX number', () => {
    expect(formatMxPhone('5512345678')).toBe('5512345678');
    expect(formatMxPhone('not a phone')).toBe('not a phone');
    expect(formatMxPhone('+15512345678')).toBe('+15512345678');
    expect(formatMxPhone('')).toBe('');
  });

  it('is consistent with normalizeMxPhone output for every accepted form', () => {
    const normalized = normalizeMxPhone('55 1234 5678');
    expect(normalized).toBe(CANONICAL);
    expect(formatMxPhone(normalized as string)).toBe('+52 55 1234 5678');
  });
});
