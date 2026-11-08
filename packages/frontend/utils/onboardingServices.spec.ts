import { describe, expect, it } from 'vitest';
import {
  formatMXNPrice,
  formatServiceDuration,
  ONBOARDING_SERVICE_DURATION_OPTIONS,
  parseMXNPrice,
} from './onboardingServices';

describe('onboarding service helpers', () => {
  it('offers sorted durations from 15 through 240 minutes in 15-minute increments, plus 40 and 50', () => {
    expect(ONBOARDING_SERVICE_DURATION_OPTIONS).toEqual([
      15, 30, 40, 45, 50, 60, 75, 90, 105, 120, 135, 150, 165, 180, 195, 210, 225, 240,
    ]);
  });

  it('formats custom and hour-based duration labels', () => {
    expect(formatServiceDuration(15)).toBe('15 min');
    expect(formatServiceDuration(40)).toBe('40 min');
    expect(formatServiceDuration(60)).toBe('1 h');
    expect(formatServiceDuration(90)).toBe('1 h 30 min');
    expect(formatServiceDuration(240)).toBe('4 h');
  });

  it('formats Mexican peso prices and parses the formatted value back to a number', () => {
    const formattedPrice = formatMXNPrice(1500);

    expect(formattedPrice).toBe('$1,500.00');
    expect(parseMXNPrice(formattedPrice)).toBe(1500);
  });

  it.each(['', '   ', 'not a price', '$abc'])(
    'treats empty or invalid price input %j as zero',
    (input) => {
      expect(parseMXNPrice(input)).toBe(0);
    },
  );
});
