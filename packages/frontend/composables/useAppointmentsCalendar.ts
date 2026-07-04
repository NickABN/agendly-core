import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import type { Ref } from 'vue';
import { utcToDateKey } from '@agendly/shared';
import type { CalendarView } from './useCalendarNav';

export interface CalendarAppointment {
  id: string;
  clientName: string;
  clientPhone: string;
  clientEmail: string | null;
  startTime: string;
  endTime: string;
  status: string;
  channel: string;
  employee: { id: string; name: string };
  service: { id: string; name: string; durationMinutes: number };
}

export type MonthDensity = Record<string, { count: number; employees: string[] }>;

const POLL_INTERVAL_MS = 15_000;

/**
 * Data layer for the admin calendar: one generic fetch per view, polling for
 * the ACTIVE view only while the tab is visible, and proper listener cleanup.
 */
export function useAppointmentsCalendar(nav: {
  view: Ref<CalendarView>;
  selectedDate: Ref<string>;
  weekStart: Ref<string>;
  monthYear: Ref<number>;
  monthMonth: Ref<number>;
}) {
  const api = useApi();

  const dayAppointments = ref<CalendarAppointment[]>([]);
  const weekAppointments = ref<CalendarAppointment[]>([]);
  const monthDensity = ref<MonthDensity>({});
  const loading = ref(false);
  const error = ref('');
  /** aria-live announcement for screen readers when polling refreshes data. */
  const announcement = ref('');

  async function refresh() {
    loading.value = true;
    error.value = '';
    try {
      if (nav.view.value === 'day') {
        dayAppointments.value = await api.get<CalendarAppointment[]>(
          `/appointments/day?date=${nav.selectedDate.value}`,
        );
      } else if (nav.view.value === 'week') {
        weekAppointments.value = await api.get<CalendarAppointment[]>(
          `/appointments/week?startDate=${nav.weekStart.value}`,
        );
      } else {
        monthDensity.value = await api.get<MonthDensity>(
          `/appointments/month?year=${nav.monthYear.value}&month=${nav.monthMonth.value}`,
        );
      }
    } catch {
      error.value = 'No se pudieron cargar las citas. Revisa tu conexión.';
    } finally {
      loading.value = false;
    }
  }

  /** Week appointments grouped once per change — O(1) lookup per day column. */
  const weekByDate = computed(() => {
    const map = new Map<string, CalendarAppointment[]>();
    for (const appt of weekAppointments.value) {
      const key = utcToDateKey(appt.startTime);
      const list = map.get(key);
      if (list) list.push(appt);
      else map.set(key, [appt]);
    }
    return map;
  });

  async function updateStatus(id: string, status: string, reason?: string) {
    await api.patch(`/appointments/${id}/status`, {
      status,
      cancellationReason: reason,
    });
    await refresh();
  }

  // ── Refetch on navigation ──
  watch(
    [nav.view, nav.selectedDate, nav.weekStart, nav.monthYear, nav.monthMonth],
    () => refresh(),
  );

  // ── Polling: active view only, paused while the tab is hidden ──
  let pollInterval: ReturnType<typeof setInterval> | null = null;

  async function poll() {
    await refresh();
    announcement.value = `Agenda actualizada a las ${new Date().toLocaleTimeString('es-MX')}`;
  }

  function startPolling() {
    stopPolling();
    pollInterval = setInterval(() => void poll(), POLL_INTERVAL_MS);
  }

  function stopPolling() {
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
  }

  function onVisibilityChange() {
    if (document.hidden) {
      stopPolling();
    } else {
      void refresh();
      startPolling();
    }
  }

  onMounted(() => {
    void refresh();
    startPolling();
    document.addEventListener('visibilitychange', onVisibilityChange);
  });

  onUnmounted(() => {
    stopPolling();
    document.removeEventListener('visibilitychange', onVisibilityChange);
  });

  return {
    dayAppointments,
    weekAppointments,
    weekByDate,
    monthDensity,
    loading,
    error,
    announcement,
    refresh,
    updateStatus,
  };
}
