import { ref } from 'vue';
import { addDays, todayKey } from '@agendly/shared';
import type { InsightsSummaryDto } from '@agendly/shared';

export type InsightsRange = 30 | 90 | 365;

/** Impact metrics (GET /insights/summary) for a trailing range of days. */
export function useInsights() {
  const api = useApi();
  const timezone = useBusinessTimezone();

  const summary = ref<InsightsSummaryDto | null>(null);
  const range = ref<InsightsRange>(30);
  const pending = ref(false);
  const error = ref('');

  async function load() {
    pending.value = true;
    error.value = '';
    try {
      const to = todayKey(timezone.value);
      const from = addDays(to, -(range.value - 1));
      summary.value = await api.get<InsightsSummaryDto>(`/insights/summary?from=${from}&to=${to}`);
    } catch {
      error.value = 'No se pudieron cargar las métricas.';
    } finally {
      pending.value = false;
    }
  }

  async function setRange(days: InsightsRange) {
    range.value = days;
    await load();
  }

  return { summary, range, pending, error, load, setRange };
}

/** 0.256 → "26%"; null → "—". */
export function formatPercent(value: number | null): string {
  return value === null ? '—' : `${Math.round(value * 100)}%`;
}

/** Seconds → "45 s" / "2 min 5 s"; null → "—". */
export function formatSeconds(value: number | null): string {
  if (value === null) return '—';
  const total = Math.round(value);
  if (total < 60) return `${total} s`;
  const min = Math.floor(total / 60);
  const sec = total % 60;
  return sec === 0 ? `${min} min` : `${min} min ${sec} s`;
}

/** Hours → "5 h" / "3.5 días"; null → "—". */
export function formatLeadTime(hours: number | null): string {
  if (hours === null) return '—';
  if (hours < 48) return `${Math.round(hours)} h`;
  return `${Math.round((hours / 24) * 10) / 10} días`;
}
