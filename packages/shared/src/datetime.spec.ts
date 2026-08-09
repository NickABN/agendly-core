import { describe, expect, it } from 'vitest';
import {
  BUSINESS_TZ,
  addDays,
  dateKeyRange,
  dayBoundsUtc,
  dayOfWeekOf,
  formatDate,
  formatDateKey,
  formatTime,
  isPast,
  isValidIanaTimeZone,
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

describe('tenant timezone support', () => {
  it('zonedToUtc converts wall time in an explicit IANA timezone', () => {
    // Tijuana observes DST: UTC-7 in July, UTC-8 in January
    expect(zonedToUtc('2026-07-03', '10:00', 'America/Tijuana').toISOString()).toBe(
      '2026-07-03T17:00:00.000Z',
    );
    expect(zonedToUtc('2026-01-15', '10:00', 'America/Tijuana').toISOString()).toBe(
      '2026-01-15T18:00:00.000Z',
    );
    // Cancun is fixed at UTC-5 (no DST)
    expect(zonedToUtc('2026-07-03', '10:00', 'America/Cancun').toISOString()).toBe(
      '2026-07-03T15:00:00.000Z',
    );
    // Hermosillo (Sonora) is fixed at UTC-7 year-round (no DST)
    expect(zonedToUtc('2026-07-03', '10:00', 'America/Hermosillo').toISOString()).toBe(
      '2026-07-03T17:00:00.000Z',
    );
    expect(zonedToUtc('2026-01-15', '10:00', 'America/Hermosillo').toISOString()).toBe(
      '2026-01-15T17:00:00.000Z',
    );
  });

  describe('DST edges in America/Tijuana (locks current deterministic behavior)', () => {
    // These tests document the semantics of the two-pass Intl round-trip in
    // zonedToUtc at the two DST discontinuities. They exist to lock the
    // CURRENT deterministic pick, not to prescribe it: if the algorithm
    // changes, these must be revisited consciously.

    it('spring-forward gap: a nonexistent wall time resolves deterministically', () => {
      // On 2026-03-08 clocks in Tijuana jump from 02:00 PST (UTC-8) straight
      // to 03:00 PDT (UTC-7): 02:30 never exists on the wall clock.
      // The second pass of the round-trip lands on the post-transition offset
      // (UTC-7), so 02:30 maps to 09:30Z — an instant whose actual wall time
      // is 01:30 PST, i.e. 60 minutes BEFORE the gap. Callers must not assume
      // utcToZonedMinutes(zonedToUtc(t)) === t inside the gap.
      const gap = zonedToUtc('2026-03-08', '02:30', 'America/Tijuana');
      expect(gap.toISOString()).toBe('2026-03-08T09:30:00.000Z');
      expect(utcToZonedMinutes(gap, 'America/Tijuana')).toBe(1 * 60 + 30);

      // Sanity: wall times on either side of the gap behave normally.
      expect(zonedToUtc('2026-03-08', '01:59', 'America/Tijuana').toISOString()).toBe(
        '2026-03-08T09:59:00.000Z', // still PST (UTC-8)
      );
      expect(zonedToUtc('2026-03-08', '03:00', 'America/Tijuana').toISOString()).toBe(
        '2026-03-08T10:00:00.000Z', // first minute of PDT (UTC-7)
      );
    });

    it('fall-back ambiguity: a repeated wall time resolves to the first (DST) occurrence', () => {
      // On 2026-11-01 clocks fall back from 02:00 PDT to 01:00 PST: the wall
      // time 01:30 happens twice (08:30Z as PDT and 09:30Z as PST). The
      // round-trip settles on the FIRST occurrence, 08:30Z (UTC-7), and the
      // conversion round-trips cleanly for that pick.
      const ambiguous = zonedToUtc('2026-11-01', '01:30', 'America/Tijuana');
      expect(ambiguous.toISOString()).toBe('2026-11-01T08:30:00.000Z');
      expect(utcToZonedMinutes(ambiguous, 'America/Tijuana')).toBe(1 * 60 + 30);

      // Sanity: unambiguous wall times around the fold behave normally.
      expect(zonedToUtc('2026-11-01', '00:59', 'America/Tijuana').toISOString()).toBe(
        '2026-11-01T07:59:00.000Z', // still PDT (UTC-7)
      );
      expect(zonedToUtc('2026-11-01', '02:00', 'America/Tijuana').toISOString()).toBe(
        '2026-11-01T10:00:00.000Z', // firmly PST (UTC-8)
      );
    });
  });

  it('utcToZonedMinutes and utcToDateKey honor the given timezone', () => {
    const instant = zonedToUtc('2026-07-03', '14:45', 'America/Tijuana');
    expect(utcToZonedMinutes(instant, 'America/Tijuana')).toBe(14 * 60 + 45);
    expect(utcToDateKey(instant, 'America/Tijuana')).toBe('2026-07-03');
  });

  it('assigns near-midnight instants to different calendar days per timezone', () => {
    // 06:30Z on July 4 = 00:30 July 4 in CDMX (UTC-6) but 23:30 July 3 in Tijuana (UTC-7)
    const instant = new Date('2026-07-04T06:30:00.000Z');
    expect(utcToDateKey(instant, BUSINESS_TZ)).toBe('2026-07-04');
    expect(utcToDateKey(instant, 'America/Tijuana')).toBe('2026-07-03');
  });

  it('dayBoundsUtc spans the calendar day of the given timezone', () => {
    const tijuana = dayBoundsUtc('2026-07-03', 'America/Tijuana');
    expect(tijuana.start.toISOString()).toBe('2026-07-03T07:00:00.000Z');
    expect(tijuana.end.toISOString()).toBe('2026-07-04T07:00:00.000Z');

    const cancun = dayBoundsUtc('2026-07-03', 'America/Cancun');
    expect(cancun.start.toISOString()).toBe('2026-07-03T05:00:00.000Z');
    expect(cancun.end.toISOString()).toBe('2026-07-04T05:00:00.000Z');
  });

  it('todayKey resolves "today" in the given timezone', () => {
    const now = new Date('2026-07-04T06:30:00.000Z');
    expect(todayKey(BUSINESS_TZ, now)).toBe('2026-07-04');
    expect(todayKey('America/Tijuana', now)).toBe('2026-07-03');
  });

  it('formatTime and formatDate render wall time of the given timezone', () => {
    // 16:00Z = 11:00 in Cancun (UTC-5), 10:00 in CDMX
    expect(formatTime('2026-07-03T16:00:00.000Z', 'America/Cancun')).toMatch(/11:00/);
    // 06:00Z July 4 = 23:00 July 3 in Tijuana but 00:00 July 4 in CDMX
    const label = formatDate('2026-07-04T06:00:00.000Z', 'long', 'America/Tijuana');
    expect(label).toContain('3');
    expect(label).toContain('julio');
    expect(formatDate('2026-07-04T06:00:00.000Z', 'long', BUSINESS_TZ)).toContain('4');
  });
});

describe('isValidIanaTimeZone', () => {
  it('accepts valid IANA identifiers', () => {
    expect(isValidIanaTimeZone('America/Mexico_City')).toBe(true);
    expect(isValidIanaTimeZone('America/Tijuana')).toBe(true);
    expect(isValidIanaTimeZone('America/Cancun')).toBe(true);
    expect(isValidIanaTimeZone('America/Hermosillo')).toBe(true);
  });

  it('rejects invalid names', () => {
    expect(isValidIanaTimeZone('America/FakeCity')).toBe(false);
    expect(isValidIanaTimeZone('')).toBe(false);
    expect(isValidIanaTimeZone('not a timezone')).toBe(false);
  });
});

describe('todayKey / isPast', () => {
  it('todayKey uses the business timezone by default, not the runtime one', () => {
    // 05:00 UTC on July 4 is still July 3 in Mexico City
    expect(todayKey(BUSINESS_TZ, new Date('2026-07-04T05:00:00.000Z'))).toBe('2026-07-03');
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
