import { describe, expect, it } from 'vitest';
import { formatMxPhone, formatPhone, normalizeMxPhone, normalizePhone } from './phone';

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

describe('normalizePhone (international)', () => {
  it.each([
    // No "+" → MX rules (unchanged behavior, 10 digits default to Mexico)
    ['5512345678', CANONICAL],
    ['55 1234 5678', CANONICAL],
    ['(55) 1234 5678', CANONICAL],
    ['525512345678', CANONICAL],
    ['0445512345678', CANONICAL],
    // "+52..." still goes through the MX rules (legacy "+521..." collapses)
    ['+525512345678', CANONICAL],
    ['+52 55 1234 5678', CANONICAL],
    ['+5215512345678', CANONICAL],
    ['+521 55 1234 5678', CANONICAL],
  ])('keeps MX behavior for %s', (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  it.each([
    // International "+" inputs: strip separators, accept E.164, return as-is
    ['+1 415 555 1234', '+14155551234'],
    ['+14155551234', '+14155551234'],
    ['+1 (415) 555-1234', '+14155551234'],
    ['+34 612 345 678', '+34612345678'],
    ['+34612345678', '+34612345678'],
    ['+44 20 7946 0958', '+442079460958'],
    ['+81.90.1234.5678', '+819012345678'],
  ])('accepts international %s as %s', (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  it('is idempotent for international numbers', () => {
    const once = normalizePhone('+1 415 555 1234');
    expect(once).toBe('+14155551234');
    expect(normalizePhone(once as string)).toBe(once);
  });

  it.each([
    ['empty string', ''],
    ['only separators', '()- .'],
    ['letters', 'abcdefghij'],
    ['plus with letters', '+1 415 555 ABCD'],
    ['plus without digits', '+'],
    ['leading zero country code', '+0123456789'],
    ['too short (+ and 7 digits)', '+1234567'],
    ['too long (+ and 16 digits)', '+11234567890123456'],
    ['bare 9 digits (not a valid MX number)', '551234567'],
  ])('rejects %s -> null', (_label, input) => {
    expect(normalizePhone(input)).toBeNull();
  });
});

describe('formatPhone', () => {
  it('formats a normalized MX number like formatMxPhone', () => {
    expect(formatPhone(CANONICAL)).toBe('+52 55 1234 5678');
    expect(formatPhone(CANONICAL)).toBe(formatMxPhone(CANONICAL));
  });

  it('returns non-MX E.164 values unchanged', () => {
    expect(formatPhone('+14155551234')).toBe('+14155551234');
    expect(formatPhone('+34612345678')).toBe('+34612345678');
  });

  it('returns arbitrary input unchanged when it is not a normalized MX number', () => {
    expect(formatPhone('not a phone')).toBe('not a phone');
    expect(formatPhone('')).toBe('');
  });
});
