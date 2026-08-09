import { DayOfWeek } from './enums';

/**
 * Single source of truth for date/time handling across backend and frontend.
 *
 * Wire contract:
 * - Every appointment/slot instant crosses the API as ISO-8601 UTC with `Z`
 *   (e.g. "2026-07-03T15:00:00.000Z").
 * - Date-only parameters are date keys ("YYYY-MM-DD") and ALWAYS mean a
 *   calendar day in the tenant's timezone. Mexico spans 4 IANA zones
 *   (Mexico_City, Cancun, Hermosillo/Mazatlan, Tijuana), so every conversion
 *   helper takes an explicit `tz`. `BUSINESS_TZ` is only the documented
 *   default for tenants that never changed their timezone.
 * - Never emit zoneless datetime strings; never parse one with `new Date()`.
 *
 * All functions are pure and rely only on Intl (works in Node 18+ and browsers).
 */
export const BUSINESS_TZ = 'America/Mexico_City';

const LOCALE = 'es-MX';

const WEEKDAYS: DayOfWeek[] = [
  DayOfWeek.SUNDAY,
  DayOfWeek.MONDAY,
  DayOfWeek.TUESDAY,
  DayOfWeek.WEDNESDAY,
  DayOfWeek.THURSDAY,
  DayOfWeek.FRIDAY,
  DayOfWeek.SATURDAY,
];

/** Whether `tz` is an IANA timezone identifier the runtime's Intl accepts. */
export function isValidIanaTimeZone(tz: string): boolean {
  if (typeof tz !== 'string' || tz.length === 0) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

function parseDateKey(dateKey: string): [number, number, number] {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) {
    throw new Error(`Fecha inválida, se espera YYYY-MM-DD: "${dateKey}"`);
  }
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function parseTime(time: string): [number, number, number] {
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(time);
  if (!match) {
    throw new Error(`Hora inválida, se espera HH:mm[:ss]: "${time}"`);
  }
  return [Number(match[1]), Number(match[2]), Number(match[3] ?? 0)];
}

function toDate(value: string | Date): Date {
  if (value instanceof Date) return value;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`Instante inválido: "${value}"`);
  }
  return d;
}

// Intl.DateTimeFormat construction is expensive; cache one formatter per
// timezone (and per style for date formatting). Tenants use a handful of
// zones, so the maps stay tiny.
const wallClockFormatters = new Map<string, Intl.DateTimeFormat>();
const dateKeyFormatters = new Map<string, Intl.DateTimeFormat>();
const timeFormatters = new Map<string, Intl.DateTimeFormat>();
const dateFormatters = new Map<string, Intl.DateTimeFormat>();

function wallClockFormatter(tz: string): Intl.DateTimeFormat {
  let formatter = wallClockFormatters.get(tz);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    });
    wallClockFormatters.set(tz, formatter);
  }
  return formatter;
}

/** Offset (ms) of `tz` at the given instant. Negative means west of UTC. */
function tzOffsetMs(instant: Date, tz: string): number {
  const parts = wallClockFormatter(tz).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour'),
    get('minute'),
    get('second'),
  );
  return asUtc - instant.getTime();
}

/**
 * Interpret a wall-clock date+time in the given timezone and return the UTC instant.
 * Two-pass Intl round-trip: exact for any offset (including minute offsets and DST edges).
 */
export function zonedToUtc(dateKey: string, time: string, tz: string = BUSINESS_TZ): Date {
  const [y, m, d] = parseDateKey(dateKey);
  const [hh, mm, ss] = parseTime(time);
  const wallAsUtc = Date.UTC(y, m - 1, d, hh, mm, ss);
  let instant = wallAsUtc - tzOffsetMs(new Date(wallAsUtc), tz);
  instant = wallAsUtc - tzOffsetMs(new Date(instant), tz);
  return new Date(instant);
}

/** Minutes since the timezone's midnight for a UTC instant (0..1439). */
export function utcToZonedMinutes(instant: string | Date, tz: string = BUSINESS_TZ): number {
  const parts = wallClockFormatter(tz).formatToParts(toDate(instant));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return get('hour') * 60 + get('minute');
}

function dateKeyFormatter(tz: string): Intl.DateTimeFormat {
  let formatter = dateKeyFormatters.get(tz);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    dateKeyFormatters.set(tz, formatter);
  }
  return formatter;
}

/** Calendar day ("YYYY-MM-DD") of the given timezone containing the UTC instant. */
export function utcToDateKey(instant: string | Date, tz: string = BUSINESS_TZ): string {
  return dateKeyFormatter(tz).format(toDate(instant));
}

/** Today's date key in the given timezone. */
export function todayKey(tz: string = BUSINESS_TZ, now: Date = new Date()): string {
  return utcToDateKey(now, tz);
}

/** Weekday of a calendar date (date keys are civil dates — TZ-independent). */
export function dayOfWeekOf(dateKey: string): DayOfWeek {
  const [y, m, d] = parseDateKey(dateKey);
  return WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

/** Calendar arithmetic on date keys. */
export function addDays(dateKey: string, days: number): string {
  const [y, m, d] = parseDateKey(dateKey);
  const shifted = new Date(Date.UTC(y, m - 1, d + days));
  return shifted.toISOString().slice(0, 10);
}

/** Monday of the week containing the given date key. */
export function startOfWeek(dateKey: string): string {
  const [y, m, d] = parseDateKey(dateKey);
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  return addDays(dateKey, diff);
}

/** Consecutive date keys starting at `startKey`. */
export function dateKeyRange(startKey: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => addDays(startKey, i));
}

/** UTC bounds [start, end) of a calendar day in the given timezone. */
export function dayBoundsUtc(
  dateKey: string,
  tz: string = BUSINESS_TZ,
): { start: Date; end: Date } {
  return {
    start: zonedToUtc(dateKey, '00:00', tz),
    end: zonedToUtc(addDays(dateKey, 1), '00:00', tz),
  };
}

/** Whether the instant is in the past (optionally allowing a grace window). */
export function isPast(instant: string | Date, graceMinutes = 0, now: Date = new Date()): boolean {
  return toDate(instant).getTime() < now.getTime() - graceMinutes * 60_000;
}

function timeFormatter(tz: string): Intl.DateTimeFormat {
  let formatter = timeFormatters.get(tz);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(LOCALE, {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
    timeFormatters.set(tz, formatter);
  }
  return formatter;
}

/** "03:30 p.m." — wall time of an instant in the given timezone, consistent 12h everywhere. */
export function formatTime(instant: string | Date, tz: string = BUSINESS_TZ): string {
  return timeFormatter(tz).format(toDate(instant));
}

function dateFormatter(tz: string, style: 'long' | 'short'): Intl.DateTimeFormat {
  const key = `${tz}|${style}`;
  let formatter = dateFormatters.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(
      LOCALE,
      style === 'long'
        ? { timeZone: tz, weekday: 'long', day: 'numeric', month: 'long' }
        : { timeZone: tz, day: 'numeric', month: 'short', year: 'numeric' },
    );
    dateFormatters.set(key, formatter);
  }
  return formatter;
}

/** "jueves, 3 de julio" (long) or "3 jul 2026" (short) — calendar day of the instant in `tz`. */
export function formatDate(
  instant: string | Date,
  style: 'long' | 'short' = 'long',
  tz: string = BUSINESS_TZ,
): string {
  return dateFormatter(tz, style).format(toDate(instant));
}

/** Format a date key (a civil calendar day) for display, without instant ambiguity. */
export function formatDateKey(dateKey: string, style: 'long' | 'short' = 'long'): string {
  const [y, m, d] = parseDateKey(dateKey);
  // Noon UTC is the same calendar day in every timezone the formatter pins.
  const formatter = new Intl.DateTimeFormat(LOCALE, {
    timeZone: 'UTC',
    ...(style === 'long'
      ? { weekday: 'long', day: 'numeric', month: 'long' }
      : { day: 'numeric', month: 'short' }),
  });
  return formatter.format(new Date(Date.UTC(y, m - 1, d, 12)));
}

/** "HH:mm" string → minutes since midnight. */
export function timeToMinutes(time: string): number {
  const [hh, mm] = parseTime(time);
  return hh * 60 + mm;
}

/** Minutes since midnight → "HH:mm". */
export function minutesToTime(minutes: number): string {
  const hh = String(Math.floor(minutes / 60)).padStart(2, '0');
  const mm = String(minutes % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}
