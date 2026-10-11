<script setup lang="ts">
import { formatDateKey } from '@agendly/shared';
import type { InsightsRange } from '~/composables/useInsights';

definePageMeta({ layout: 'admin' });
useHead({ title: 'Métricas — Agendly' });

const insights = useInsights();
onMounted(() => insights.load());

const RANGES: { days: InsightsRange; label: string }[] = [
  { days: 30, label: '30 días' },
  { days: 90, label: '90 días' },
  { days: 365, label: '1 año' },
];

const s = computed(() => insights.summary.value);

const tiles = computed(() => {
  const d = s.value;
  if (!d) return [];
  return [
    {
      label: 'Citas',
      value: String(d.totals.appointments),
      hint: `${d.totals.completed} completadas · ${d.totals.upcoming} próximas`,
    },
    {
      label: 'Reservadas solas',
      value: formatPercent(d.autonomousShare),
      hint: 'Citas que el cliente agendó en tu enlace, sin WhatsApp',
    },
    {
      label: 'Inasistencias',
      value: formatPercent(d.noShowRate),
      hint: `${d.totals.noShows} de ${d.totals.completed + d.totals.noShows} citas ya atendidas`,
    },
    {
      label: 'Tiempo para reservar',
      value: formatSeconds(d.medianBookingDurationSec),
      hint: 'Mediana desde que abren tu enlace hasta confirmar',
    },
    {
      label: 'Clientes que regresan',
      value: d.uniqueClients > 0 ? `${d.returningClients} de ${d.uniqueClients}` : '—',
      hint: 'Ya te habían visitado antes de este periodo',
    },
    {
      label: 'Anticipación',
      value: formatLeadTime(d.medianLeadTimeHours),
      hint: 'Mediana entre la reserva y la cita',
    },
  ];
});

const maxWeekly = computed(() => Math.max(1, ...(s.value?.weekly.map((w) => w.total) ?? [])));

function weekLabel(weekStart: string): string {
  return formatDateKey(weekStart, 'short');
}

/** Plain-language reading of the AUC for the owner / thesis reader. */
const aucReading = computed(() => {
  const auc = s.value?.riskModel.auc;
  if (auc === null || auc === undefined)
    return 'Aún no hay suficientes citas atendidas con y sin falta para evaluarlo.';
  if (auc >= 0.75) return 'Distingue bien a quién es más probable que falte.';
  if (auc >= 0.6) return 'Distingue moderadamente; mejorará con más historial.';
  return 'Todavía no distingue mejor que el azar en tu negocio; necesita más historial.';
});
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <header
      class="flex flex-wrap items-center gap-3 px-4 md:px-6 py-2 md:h-16 bg-white/80 backdrop-blur-md border-b border-[var(--color-outline-variant)]/10 sticky top-0 z-40 shrink-0"
    >
      <h1 class="text-lg font-bold tracking-tight">Métricas</h1>
      <div class="flex-1"></div>
      <div
        class="flex p-1 bg-[var(--color-surface-container-low)] rounded-xl"
        role="group"
        aria-label="Periodo"
      >
        <button
          v-for="r in RANGES"
          :key="r.days"
          class="px-3 py-1.5 text-xs font-semibold rounded-lg transition-all"
          :class="
            insights.range.value === r.days
              ? 'bg-white shadow-sm text-[var(--color-primary)]'
              : 'text-[var(--color-on-surface-variant)] hover:text-[var(--color-on-surface)]'
          "
          :aria-pressed="insights.range.value === r.days"
          @click="insights.setRange(r.days)"
        >
          {{ r.label }}
        </button>
      </div>
    </header>

    <div class="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
      <div class="max-w-5xl mx-auto w-full space-y-6">
        <p class="text-sm text-[var(--color-on-surface-variant)] max-w-2xl">
          Cómo te está ayudando Agendly: cuántas citas llegan solas, cuánto tardan tus clientes en
          reservar y cuántos faltan.
          <span v-if="s"
            >Del {{ formatDateKey(s.from, 'short') }} al {{ formatDateKey(s.to, 'short') }}.</span
          >
        </p>

        <div
          v-if="insights.error.value"
          class="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-100"
          role="alert"
        >
          <span class="material-symbols-outlined text-red-500 text-lg" aria-hidden="true"
            >error</span
          >
          <p class="text-sm text-red-700">{{ insights.error.value }}</p>
        </div>

        <div
          v-if="insights.pending.value && !s"
          class="flex items-center justify-center py-16"
          role="status"
        >
          <div
            class="w-6 h-6 border-2 border-[var(--color-primary)]/30 border-t-[var(--color-primary)] rounded-full animate-spin"
            aria-hidden="true"
          ></div>
        </div>

        <template v-else-if="s">
          <!-- KPI tiles -->
          <div class="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
            <div
              v-for="t in tiles"
              :key="t.label"
              class="p-4 md:p-5 bg-white rounded-xl shadow-sm border border-[var(--color-outline-variant)]/10"
            >
              <p
                class="text-[10px] font-bold uppercase tracking-widest text-[var(--color-outline)] mb-1"
              >
                {{ t.label }}
              </p>
              <p class="text-2xl md:text-3xl font-black text-[var(--color-on-surface)]">
                {{ t.value }}
              </p>
              <p class="text-[11px] text-[var(--color-on-surface-variant)] mt-1 leading-snug">
                {{ t.hint }}
              </p>
            </div>
          </div>

          <!-- Weekly appointments -->
          <section
            class="bg-white rounded-xl p-5 md:p-6 shadow-sm border border-[var(--color-outline-variant)]/10"
          >
            <h2 class="text-sm font-bold text-[var(--color-on-surface)] mb-1">Citas por semana</h2>
            <p class="text-xs text-[var(--color-on-surface-variant)] mb-5">
              Pasa el cursor o toca una barra para ver el detalle.
            </p>

            <p
              v-if="s.weekly.length === 0"
              class="text-sm text-[var(--color-on-surface-variant)] py-8 text-center"
            >
              Aún no hay citas en este periodo.
            </p>
            <div
              v-else
              class="flex items-end gap-[2px] h-40 border-b border-[var(--color-outline-variant)]/40"
              role="img"
              :aria-label="`Citas por semana: ${s.weekly.map((w) => `${weekLabel(w.weekStart)} ${w.total}`).join(', ')}`"
            >
              <div
                v-for="w in s.weekly"
                :key="w.weekStart"
                class="group relative flex-1 h-full flex items-end justify-center"
                tabindex="0"
              >
                <div
                  class="w-full max-w-10 rounded-t bg-[var(--color-primary)] group-hover:opacity-80 group-focus:opacity-80 transition-opacity"
                  :style="{ height: `${(w.total / maxWeekly) * 100}%` }"
                ></div>
                <div
                  class="pointer-events-none absolute bottom-full mb-2 z-10 hidden group-hover:block group-focus:block whitespace-nowrap rounded-lg bg-[var(--color-on-surface)] text-white text-[11px] px-2.5 py-1.5 shadow-lg"
                >
                  <p class="font-bold">Semana del {{ weekLabel(w.weekStart) }}</p>
                  <p>{{ w.total }} citas · {{ w.autonomous }} solas · {{ w.noShows }} faltas</p>
                </div>
              </div>
            </div>
            <div
              v-if="s.weekly.length > 0"
              class="flex justify-between mt-2 text-[10px] text-[var(--color-outline)]"
            >
              <span>{{ weekLabel(s.weekly[0].weekStart) }}</span>
              <span>{{ weekLabel(s.weekly[s.weekly.length - 1].weekStart) }}</span>
            </div>

            <details
              v-if="s.weekly.length > 0"
              class="mt-4 text-xs text-[var(--color-on-surface-variant)]"
            >
              <summary class="cursor-pointer font-semibold">Ver como tabla</summary>
              <table class="mt-2 w-full text-left">
                <thead>
                  <tr class="text-[var(--color-outline)]">
                    <th class="py-1 font-semibold">Semana</th>
                    <th class="py-1 font-semibold text-right">Citas</th>
                    <th class="py-1 font-semibold text-right">Solas</th>
                    <th class="py-1 font-semibold text-right">Faltas</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="w in s.weekly"
                    :key="w.weekStart"
                    class="border-t border-[var(--color-outline-variant)]/20"
                  >
                    <td class="py-1">{{ weekLabel(w.weekStart) }}</td>
                    <td class="py-1 text-right">{{ w.total }}</td>
                    <td class="py-1 text-right">{{ w.autonomous }}</td>
                    <td class="py-1 text-right">{{ w.noShows }}</td>
                  </tr>
                </tbody>
              </table>
            </details>
          </section>

          <!-- Email reminders -->
          <section
            class="bg-white rounded-xl p-5 md:p-6 shadow-sm border border-[var(--color-outline-variant)]/10"
          >
            <div class="flex items-center gap-2 mb-1">
              <span class="material-symbols-outlined text-[var(--color-primary)]" aria-hidden="true"
                >mark_email_read</span
              >
              <h2 class="text-sm font-bold text-[var(--color-on-surface)]">
                Recordatorios por correo
              </h2>
            </div>
            <p class="text-xs text-[var(--color-on-surface-variant)] mb-4 max-w-2xl">
              Un día antes de cada cita, Agendly le recuerda al cliente si dejó su correo. A las
              citas con riesgo alto les pide confirmar o avisar si no puede asistir.
            </p>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div class="p-3 rounded-lg bg-[var(--color-surface-container-low)]">
                <p
                  class="text-[10px] font-bold uppercase tracking-widest text-[var(--color-outline)]"
                >
                  Enviados
                </p>
                <p class="text-xl font-black">{{ s.reminders.sent }}</p>
              </div>
              <div class="p-3 rounded-lg bg-[var(--color-surface-container-low)]">
                <p
                  class="text-[10px] font-bold uppercase tracking-widest text-[var(--color-outline)]"
                >
                  Faltas con recordatorio
                </p>
                <p class="text-xl font-black">
                  {{ formatPercent(s.reminders.noShowRateWithReminder) }}
                </p>
              </div>
              <div class="p-3 rounded-lg bg-[var(--color-surface-container-low)]">
                <p
                  class="text-[10px] font-bold uppercase tracking-widest text-[var(--color-outline)]"
                >
                  Faltas sin recordatorio
                </p>
                <p class="text-xl font-black">
                  {{ formatPercent(s.reminders.noShowRateWithoutReminder) }}
                </p>
              </div>
            </div>
            <p class="text-[11px] text-[var(--color-outline)] mt-3">
              Comparación observacional: los clientes sin correo no reciben recordatorio.
            </p>
          </section>

          <!-- Risk model -->
          <section
            class="bg-white rounded-xl p-5 md:p-6 shadow-sm border border-[var(--color-outline-variant)]/10"
          >
            <div class="flex items-center gap-2 mb-1">
              <span class="material-symbols-outlined text-[var(--color-primary)]" aria-hidden="true"
                >psychology</span
              >
              <h2 class="text-sm font-bold text-[var(--color-on-surface)]">
                Predicción de inasistencias
              </h2>
            </div>
            <p class="text-xs text-[var(--color-on-surface-variant)] mb-4 max-w-2xl">
              Agendly estima qué citas tienen más riesgo de que el cliente no llegue (historial de
              faltas, si es nuevo, anticipación) y las marca en tu agenda. Aquí ves qué tan bien
              acertó con las citas ya atendidas de este periodo. Es solo una ayuda: no se usa para
              negar citas.
            </p>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div class="p-3 rounded-lg bg-[var(--color-surface-container-low)]">
                <p
                  class="text-[10px] font-bold uppercase tracking-widest text-[var(--color-outline)]"
                >
                  Citas evaluadas
                </p>
                <p class="text-xl font-black">{{ s.riskModel.samples }}</p>
              </div>
              <div class="p-3 rounded-lg bg-[var(--color-surface-container-low)]">
                <p
                  class="text-[10px] font-bold uppercase tracking-widest text-[var(--color-outline)]"
                >
                  AUC
                </p>
                <p class="text-xl font-black">{{ s.riskModel.auc ?? '—' }}</p>
              </div>
              <div class="p-3 rounded-lg bg-[var(--color-surface-container-low)]">
                <p
                  class="text-[10px] font-bold uppercase tracking-widest text-[var(--color-outline)]"
                >
                  Faltas detectadas
                </p>
                <p class="text-xl font-black">{{ formatPercent(s.riskModel.recallFlagged) }}</p>
              </div>
              <div class="p-3 rounded-lg bg-[var(--color-surface-container-low)]">
                <p
                  class="text-[10px] font-bold uppercase tracking-widest text-[var(--color-outline)]"
                >
                  Alertas acertadas
                </p>
                <p class="text-xl font-black">{{ formatPercent(s.riskModel.precisionFlagged) }}</p>
              </div>
            </div>
            <p class="text-xs text-[var(--color-on-surface-variant)] mt-3">
              {{ aucReading }}
              <span class="text-[var(--color-outline)]"
                >Modelo {{ s.riskModel.version }} · Brier {{ s.riskModel.brier ?? '—' }}</span
              >
            </p>
          </section>
        </template>
      </div>
    </div>
  </div>
</template>
