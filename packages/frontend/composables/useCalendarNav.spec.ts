import { describe, expect, it } from 'vitest';
import { useCalendarNav } from './useCalendarNav';

describe('useCalendarNav', () => {
  it('starts on day view at today', () => {
    const nav = useCalendarNav();
    expect(nav.view.value).toBe('day');
    expect(nav.isToday.value).toBe(true);
  });

  it('navigates days across month boundaries', () => {
    const nav = useCalendarNav();
    nav.selectedDate.value = '2026-08-01';
    nav.prev();
    expect(nav.selectedDate.value).toBe('2026-07-31');
    nav.next();
    nav.next();
    expect(nav.selectedDate.value).toBe('2026-08-02');
  });

  it('weekDays always spans Monday to Sunday', () => {
    const nav = useCalendarNav();
    nav.weekStart.value = '2026-06-29'; // a Monday
    const days = nav.weekDays.value;
    expect(days).toHaveLength(7);
    expect(days[0].date).toBe('2026-06-29');
    expect(days[6].date).toBe('2026-07-05');
    expect(days[6].isSunday).toBe(true);
  });

  it('week navigation moves in 7-day steps', () => {
    const nav = useCalendarNav();
    nav.view.value = 'week';
    nav.weekStart.value = '2026-06-29';
    nav.next();
    expect(nav.weekStart.value).toBe('2026-07-06');
    nav.prev();
    nav.prev();
    expect(nav.weekStart.value).toBe('2026-06-22');
  });

  it('month grid is Monday-based, padded to 35 or 42 cells, and flags the current month', () => {
    const nav = useCalendarNav();
    nav.monthCursor.value = '2026-07'; // July 1st 2026 is a Wednesday
    const days = nav.monthDays.value;
    expect([35, 42]).toContain(days.length);
    // Grid starts Monday June 29
    expect(days[0].date).toBe('2026-06-29');
    expect(days[0].currentMonth).toBe(false);
    expect(days[2].date).toBe('2026-07-01');
    expect(days[2].currentMonth).toBe(true);
    expect(days.filter((d) => d.currentMonth)).toHaveLength(31);
  });

  it('month navigation wraps across years', () => {
    const nav = useCalendarNav();
    nav.view.value = 'month';
    nav.monthCursor.value = '2026-12';
    nav.next();
    expect(nav.monthCursor.value).toBe('2027-01');
    nav.prev();
    nav.prev();
    expect(nav.monthCursor.value).toBe('2026-11');
  });

  it('goToDay switches to day view at the given date', () => {
    const nav = useCalendarNav();
    nav.view.value = 'month';
    nav.goToDay('2026-07-15');
    expect(nav.view.value).toBe('day');
    expect(nav.selectedDate.value).toBe('2026-07-15');
  });
});
