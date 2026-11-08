/**
 * Mexican phone number normalization to E.164 (+52XXXXXXXXXX).
 *
 * `Appointment.clientPhone` is the client's identity (client CRM grouping and
 * no-show history both key on it), so the same raw number typed three ways
 * ("55 1234 5678", "5512345678", "+52 55 1234 5678") must collapse to one
 * canonical value. This is the single source of truth shared by the backend
 * write paths and the frontend booking form.
 */

/** 10 national significant digits for a Mexican number (area/mobile + subscriber). */
const NATIONAL_DIGITS = 10;

/**
 * Normalize a Mexican phone number to E.164 (`+52` + 10 national digits).
 *
 * Accepted inputs (after stripping spaces, dashes, dots and parentheses):
 * - 10 digits                         → `+52` + digits
 * - `52` + 10 digits                  → `+52` + digits
 * - `+52` + 10 digits                 → unchanged (canonical)
 * - legacy mobile `521`/`+521` + 10   → drop the `1`, keep the 10 digits
 * - legacy `044`/`045` + 10 digits    → drop the prefix, keep the 10 digits
 *
 * Anything else (letters, wrong length, other country codes) returns `null`.
 */
export function normalizeMxPhone(input: string): string | null {
  if (typeof input !== 'string') return null;

  const hadPlus = input.trim().startsWith('+');
  // Strip every separator we tolerate; keep only digits.
  const digits = input.replace(/[\s().\-+]/g, '');
  if (!/^\d+$/.test(digits)) return null;

  let national: string | null = null;

  if (digits.length === NATIONAL_DIGITS) {
    // Bare 10 national digits (e.g. "5512345678").
    national = digits;
  } else if (digits.length === 12 && digits.startsWith('52')) {
    // Country code without the +1 legacy marker ("525512345678").
    national = digits.slice(2);
  } else if (digits.length === 13 && digits.startsWith('521')) {
    // Legacy mobile marker: 52 + 1 + 10 digits. Drop the 1.
    national = digits.slice(3);
  } else if (
    !hadPlus &&
    digits.length === 13 &&
    (digits.startsWith('044') || digits.startsWith('045'))
  ) {
    // Legacy national long-distance prefixes. These never carry a +, so a
    // leading + rules them out (that would be a foreign number instead).
    national = digits.slice(3);
  }

  if (national === null || national.length !== NATIONAL_DIGITS) return null;
  return `+52${national}`;
}

/** E.164: a leading `+`, a non-zero country-code digit, then 7–14 more digits. */
const E164 = /^\+[1-9]\d{7,14}$/;

/**
 * Normalize any phone number to E.164, opening booking to other countries.
 *
 * - Input starting with `+`: strip spaces, dashes, dots and parentheses and
 *   accept it only if it matches E.164 (`^\+[1-9]\d{7,14}$`), returned as-is.
 *   A `+52...` input is still routed through the Mexican rules so legacy
 *   `+521...` mobile numbers collapse to the canonical `+52` + 10 digits.
 * - Input without `+`: apply the existing Mexican rules (10 digits default to
 *   Mexico) via `normalizeMxPhone`.
 * - Anything else → `null`.
 *
 * `normalizeMxPhone`/`formatMxPhone` are unchanged; this is the shared entry
 * point used by the backend DTOs and the frontend booking form.
 */
export function normalizePhone(input: string): string | null {
  if (typeof input !== 'string') return null;

  const trimmed = input.trim();

  if (trimmed.startsWith('+')) {
    // `+52...` keeps the Mexican rules so legacy markers collapse.
    if (trimmed.replace(/[\s().-]/g, '').startsWith('+52')) {
      return normalizeMxPhone(trimmed);
    }
    const compact = trimmed.replace(/[\s().-]/g, '');
    return E164.test(compact) ? compact : null;
  }

  // No leading `+`: Mexican rules (bare 10 digits default to Mexico).
  return normalizeMxPhone(trimmed);
}

/** True when `value` is already a canonical normalized MX number. */
function isNormalizedMxPhone(value: string): boolean {
  return /^\+52\d{10}$/.test(value);
}

/**
 * Display form `+52 55 1234 5678` for a normalized MX number. Any value that is
 * not already normalized is returned unchanged, so callers can format defensively.
 */
export function formatMxPhone(e164: string): string {
  if (!isNormalizedMxPhone(e164)) return e164;
  const national = e164.slice(3); // drop "+52"
  const area = national.slice(0, 2);
  const first = national.slice(2, 6);
  const second = national.slice(6);
  return `+52 ${area} ${first} ${second}`;
}

/**
 * Display form for any normalized phone. MX numbers (`+52` + 10 digits) use the
 * pretty `+52 55 1234 5678` grouping; every other value (foreign E.164 or an
 * unrecognized string) is returned unchanged.
 */
export function formatPhone(e164: string): string {
  return formatMxPhone(e164);
}
