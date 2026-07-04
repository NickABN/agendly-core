import { DayOfWeek } from './enums';

/**
 * Single source of truth for date/time handling across backend and frontend.
 *
 * Wire contract:
 * - Every appointment/slot instant crosses the API as ISO-8601 UTC with `Z`
 *   (e.g. "2026-07-03T15:00:00.000Z").
 * - Date-only parameters are date keys ("YYYY-MM-DD") and ALWAYS mean a
 *   calendar day in the business timezone (America/Mexico_City).
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

const wallClockFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: BUSINESS_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

/** Business-TZ offset (ms) at the given instant. Negative means west of UTC. */
function tzOffsetMs(instant: Date): number {
  const parts = wallClockFormatter.formatToParts(instant);
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
 * Interpret a wall-clock date+time in the business timezone and return the UTC instant.
 * Two-pass Intl round-trip: exact for any offset (including minute offsets and DST edges).
 */
export function zonedToUtc(dateKey: string, time: string): Date {
  const [y, m, d] = parseDateKey(dateKey);
  const [hh, mm, ss] = parseTime(time);
  const wallAsUtc = Date.UTC(y, m - 1, d, hh, mm, ss);
  let instant = wallAsUtc - tzOffsetMs(new Date(wallAsUtc));
  instant = wallAsUtc - tzOffsetMs(new Date(instant));
  return new Date(instant);
}

/** Minutes since business-TZ midnight for a UTC instant (0..1439). */
export function utcToZonedMinutes(instant: string | Date): number {
  const parts = wallClockFormatter.formatToParts(toDate(instant));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return get('hour') * 60 + get('minute');
}

const dateKeyFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: BUSINESS_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Business-TZ calendar day ("YYYY-MM-DD") containing the given UTC instant. */
export function utcToDateKey(instant: string | Date): string {
  return dateKeyFormatter.format(toDate(instant));
}

/** Today's date key in the business timezone. */
export function todayKey(now: Date = new Date()): string {
  return utcToDateKey(now);
}

/** Weekday of a business-TZ calendar date (date keys are civil dates — TZ-independent). */
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

/** UTC bounds [start, end) of a business-TZ calendar day. */
export function dayBoundsUtc(dateKey: string): { start: Date; end: Date } {
  return {
    start: zonedToUtc(dateKey, '00:00'),
    end: zonedToUtc(addDays(dateKey, 1), '00:00'),
  };
}

/** Whether the instant is in the past (optionally allowing a grace window). */
export function isPast(instant: string | Date, graceMinutes = 0, now: Date = new Date()): boolean {
  return toDate(instant).getTime() < now.getTime() - graceMinutes * 60_000;
}

const timeFormatter = new Intl.DateTimeFormat(LOCALE, {
  timeZone: BUSINESS_TZ,
  hour: '2-digit',
  minute: '2-digit',
  hour12: true,
});

/** "03:30 p.m." — business-TZ time of an instant, consistent 12h everywhere. */
export function formatTime(instant: string | Date): string {
  return timeFormatter.format(toDate(instant));
}

const dateFormatters: Record<string, Intl.DateTimeFormat> = {
  long: new Intl.DateTimeFormat(LOCALE, {
    timeZone: BUSINESS_TZ,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }),
  short: new Intl.DateTimeFormat(LOCALE, {
    timeZone: BUSINESS_TZ,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }),
};

/** "jueves, 3 de julio" (long) or "3 jul 2026" (short) — business-TZ date of an instant. */
export function formatDate(instant: string | Date, style: 'long' | 'short' = 'long'): string {
  return dateFormatters[style].format(toDate(instant));
}

/** Format a date key (business-TZ calendar day) for display, without instant ambiguity. */
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
