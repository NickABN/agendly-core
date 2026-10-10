import { describe, expect, it } from 'vitest';
import { formatLeadTime, formatPercent, formatSeconds } from './useInsights';
import { bookingDurationMs } from './usePublicBooking';

describe('insights formatters', () => {
  it('formats percentages', () => {
    expect(formatPercent(0.256)).toBe('26%');
    expect(formatPercent(null)).toBe('—');
  });

  it('formats booking durations', () => {
    expect(formatSeconds(45)).toBe('45 s');
    expect(formatSeconds(120)).toBe('2 min');
    expect(formatSeconds(125)).toBe('2 min 5 s');
    expect(formatSeconds(null)).toBe('—');
  });

  it('formats lead times in hours or days', () => {
    expect(formatLeadTime(5.4)).toBe('5 h');
    expect(formatLeadTime(84)).toBe('3.5 días');
    expect(formatLeadTime(null)).toBe('—');
  });
});

describe('bookingDurationMs', () => {
  it('returns elapsed ms clamped to [0, 1 h]', () => {
    expect(bookingDurationMs(1_000, 46_000)).toBe(45_000);
    expect(bookingDurationMs(5_000, 1_000)).toBe(0);
    expect(bookingDurationMs(0, 10_000_000)).toBe(3_600_000);
  });
});
