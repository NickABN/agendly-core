/**
 * Re-export of the shared datetime module so Nuxt auto-imports it everywhere.
 * ALL date/time display and math goes through these helpers — never call
 * toLocaleTimeString/toLocaleDateString without a timeZone, and never
 * `new Date(str)` on a zoneless string.
 */
export {
  BUSINESS_TZ,
  addDays,
  dateKeyRange,
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
} from '@agendly/shared';
