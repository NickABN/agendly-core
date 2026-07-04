import { describe, expect, it } from 'vitest';
import {
  addDays,
  dateKeyRange,
  dayBoundsUtc,
  dayOfWeekOf,
  formatDate,
  formatDateKey,
  formatTime,
  isPast,
  minutesToTime,
  startOfWeek,
  timeToMinutes,
  todayKey,
  utcToDateKey,
  utcToZonedMinutes,
  zonedToUtc,
} from './datetime';
import { DayOfWeek } from './enums';

// Mexico City is fixed at UTC-6 (no DST since 2022).
const OFFSET_HOURS = 6;

describe('zonedToUtc', () => {
  it('converts business wall time to the correct UTC instant', () => {
    const d = zonedToUtc('2026-07-03', '10:00');
    expect(d.toISOString()).toBe(`2026-07-03T${10 + OFFSET_HOURS}:00:00.000Z`);
  });

  it('handles seconds and single-digit hours', () => {
    expect(zonedToUtc('2026-07-03', '9:05:30').toISOString()).toBe('2026-07-03T15:05:30.000Z');
  });

  it('crosses the UTC midnight boundary for late evening times', () => {
    // 22:30 in Mexico City = 04:30 next day UTC
    expect(zonedToUtc('2026-07-03', '22:30').toISOString()).toBe('2026-07-04T04:30:00.000Z');
  });

  it('rejects malformed inputs', () => {
    expect(() => zonedToUtc('2026/07/03', '10:00')).toThrow();
    expect(() => zonedToUtc('2026-07-03', '10h00')).toThrow();
  });
});

describe('utcToZonedMinutes / utcToDateKey', () => {
  it('round-trips with zonedToUtc', () => {
    const instant = zonedToUtc('2026-07-03', '14:45');
    expect(utcToZonedMinutes(instant)).toBe(14 * 60 + 45);
    expect(utcToDateKey(instant)).toBe('2026-07-03');
  });

  it('assigns a UTC instant past midnight UTC to the previous business day', () => {
    // 2026-07-04T04:30Z is still 22:30 on 2026-07-03 in Mexico City
    const instant = new Date('2026-07-04T04:30:00.000Z');
    expect(utcToDateKey(instant)).toBe('2026-07-03');
    expect(utcToZonedMinutes(instant)).toBe(22 * 60 + 30);
  });

  it('accepts ISO strings as input', () => {
    expect(utcToDateKey('2026-07-03T16:00:00.000Z')).toBe('2026-07-03');
  });
});

describe('calendar math on date keys', () => {
  it('dayOfWeekOf matches the civil calendar', () => {
    expect(dayOfWeekOf('2026-07-03')).toBe(DayOfWeek.FRIDAY);
    expect(dayOfWeekOf('2026-07-05')).toBe(DayOfWeek.SUNDAY);
  });

  it('addDays crosses month and year boundaries', () => {
    expect(addDays('2026-07-31', 1)).toBe('2026-08-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
  });

  it('startOfWeek returns Monday, including for Sundays', () => {
    expect(startOfWeek('2026-07-03')).toBe('2026-06-29'); // Friday → Monday
    expect(startOfWeek('2026-07-05')).toBe('2026-06-29'); // Sunday → previous Monday
    expect(startOfWeek('2026-06-29')).toBe('2026-06-29'); // Monday → itself
  });

  it('dateKeyRange produces consecutive keys', () => {
    expect(dateKeyRange('2026-07-30', 3)).toEqual(['2026-07-30', '2026-07-31', '2026-08-01']);
  });

  it('dayBoundsUtc spans exactly the business-TZ day', () => {
    const { start, end } = dayBoundsUtc('2026-07-03');
    expect(start.toISOString()).toBe('2026-07-03T06:00:00.000Z');
    expect(end.toISOString()).toBe('2026-07-04T06:00:00.000Z');
    // A 23:30 appointment belongs to this day
    const late = zonedToUtc('2026-07-03', '23:30');
    expect(late >= start && late < end).toBe(true);
  });
});

describe('todayKey / isPast', () => {
  it('todayKey uses the business timezone, not the runtime one', () => {
    // 05:00 UTC on July 4 is still July 3 in Mexico City
    expect(todayKey(new Date('2026-07-04T05:00:00.000Z'))).toBe('2026-07-03');
  });

  it('isPast compares instants with optional grace', () => {
    const now = new Date('2026-07-03T18:00:00.000Z');
    expect(isPast('2026-07-03T17:59:00.000Z', 0, now)).toBe(true);
    expect(isPast('2026-07-03T17:59:00.000Z', 5, now)).toBe(false);
    expect(isPast('2026-07-03T18:01:00.000Z', 0, now)).toBe(false);
  });
});

describe('formatting', () => {
  it('formatTime renders business-TZ time regardless of runtime TZ', () => {
    // 16:00Z = 10:00 in Mexico City
    const label = formatTime('2026-07-03T16:00:00.000Z');
    expect(label).toMatch(/10:00/);
    expect(label.toLowerCase()).toContain('a');
  });

  it('formatDate renders the business-TZ calendar day', () => {
    // 04:30Z July 4 = evening of July 3 in Mexico City
    expect(formatDate('2026-07-04T04:30:00.000Z')).toContain('3');
    expect(formatDate('2026-07-04T04:30:00.000Z')).toContain('julio');
  });

  it('formatDateKey renders the key itself with no shifting', () => {
    const label = formatDateKey('2026-07-03');
    expect(label).toContain('viernes');
    expect(label).toContain('3');
  });
});

describe('time string helpers', () => {
  it('converts both directions', () => {
    expect(timeToMinutes('09:30')).toBe(570);
    expect(minutesToTime(570)).toBe('09:30');
    expect(minutesToTime(0)).toBe('00:00');
  });
});
