import { computed, ref } from 'vue';
import type { Ref } from 'vue';
import { BUSINESS_TZ, addDays, formatDateKey, startOfWeek, todayKey } from '@agendly/shared';

export type CalendarView = 'day' | 'week' | 'month';

const WEEKDAY_SHORT = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'];
const MONTH_LONG = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];
const MONTH_SHORT = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
];

function parts(dateKey: string): { year: number; month: number; day: number } {
  const [year, month, day] = dateKey.split('-').map(Number);
  return { year, month, day };
}

/**
 * Calendar navigation state: current view, cursor date, and the derived
 * day/week/month structures. All math on business-TZ date keys, where the
 * business timezone is the tenant's IANA zone (from /auth/me).
 */
export function useCalendarNav(timezone: Ref<string> = ref(BUSINESS_TZ)) {
  const today = () => todayKey(timezone.value);

  const view = ref<CalendarView>('day');
  const selectedDate = ref(today());
  const weekStart = ref(startOfWeek(today()));
  const monthCursor = ref(today().slice(0, 7)); // YYYY-MM

  const isToday = computed(() => selectedDate.value === today());

  const dayLabel = computed(() => formatDateKey(selectedDate.value));

  const weekDays = computed(() => {
    const todayDate = today();
    return Array.from({ length: 7 }, (_, i) => {
      const date = addDays(weekStart.value, i);
      return {
        date,
        dayName: WEEKDAY_SHORT[i],
        dayNumber: parts(date).day,
        isToday: date === todayDate,
        isSunday: i === 6,
      };
    });
  });

  const weekLabel = computed(() => {
    const start = parts(weekStart.value);
    const end = parts(addDays(weekStart.value, 6));
    return `${start.day} ${MONTH_SHORT[start.month - 1]} – ${end.day} ${MONTH_SHORT[end.month - 1]}, ${start.year}`;
  });

  const monthYear = computed(() => Number(monthCursor.value.slice(0, 4)));
  const monthMonth = computed(() => Number(monthCursor.value.slice(5, 7)));

  const monthLabel = computed(() => `${MONTH_LONG[monthMonth.value - 1]} ${monthYear.value}`);

  /** Month grid: Monday-based, padded to full 5/6 weeks with adjacent months. */
  const monthDays = computed(() => {
    const firstKey = `${monthCursor.value}-01`;
    const gridStart = startOfWeek(firstKey);
    const daysInMonth = new Date(Date.UTC(monthYear.value, monthMonth.value, 0)).getUTCDate();
    // Monday-based offset of day 1 within its week (0..6)
    let offsetToFirst = 0;
    while (addDays(gridStart, offsetToFirst) !== firstKey) offsetToFirst++;
    const total = offsetToFirst + daysInMonth;
    const cells = total <= 35 ? 35 : 42;
    const todayDate = today();

    return Array.from({ length: cells }, (_, i) => {
      const date = addDays(gridStart, i);
      const p = parts(date);
      return {
        date,
        day: p.day,
        currentMonth: p.year === monthYear.value && p.month === monthMonth.value,
        isToday: date === todayDate,
      };
    });
  });

  function prev() {
    if (view.value === 'day') selectedDate.value = addDays(selectedDate.value, -1);
    else if (view.value === 'week') weekStart.value = addDays(weekStart.value, -7);
    else shiftMonth(-1);
  }

  function next() {
    if (view.value === 'day') selectedDate.value = addDays(selectedDate.value, 1);
    else if (view.value === 'week') weekStart.value = addDays(weekStart.value, 7);
    else shiftMonth(1);
  }

  function shiftMonth(delta: number) {
    let y = monthYear.value;
    let m = monthMonth.value + delta;
    if (m === 0) {
      m = 12;
      y--;
    } else if (m === 13) {
      m = 1;
      y++;
    }
    monthCursor.value = `${y}-${String(m).padStart(2, '0')}`;
  }

  function goToToday() {
    const todayDate = today();
    selectedDate.value = todayDate;
    weekStart.value = startOfWeek(todayDate);
    monthCursor.value = todayDate.slice(0, 7);
  }

  /** Jump to a specific date in day view (used from week/month cells). */
  function goToDay(date: string) {
    selectedDate.value = date;
    view.value = 'day';
  }

  return {
    view,
    selectedDate,
    weekStart,
    monthCursor,
    monthYear,
    monthMonth,
    isToday,
    dayLabel,
    weekDays,
    weekLabel,
    monthLabel,
    monthDays,
    prev,
    next,
    goToToday,
    goToDay,
  };
}
