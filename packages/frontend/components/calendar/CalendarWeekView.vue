<script setup lang="ts">
import { formatTime } from '@agendly/shared';
import type { CalendarAppointment } from '~/composables/useAppointmentsCalendar';

const props = defineProps<{
  weekDays: Array<{
    date: string;
    dayName: string;
    dayNumber: number;
    isToday: boolean;
    isSunday: boolean;
  }>;
  appointmentsByDate: Map<string, CalendarAppointment[]>;
  loading: boolean;
}>();

const emit = defineEmits<{
  'select-day': [date: string];
}>();

const timezone = useBusinessTimezone();

const hasAny = computed(() => props.appointmentsByDate.size > 0);

/** Stable employee colors for the whole visible week. */
const employeeColorByName = computed(() => {
  const map = new Map<string, string>();
  for (const list of props.appointmentsByDate.values()) {
    for (const appt of list) {
      if (!map.has(appt.employee.name)) {
        map.set(appt.employee.name, colorForName(appt.employee.name));
      }
    }
  }
  return map;
});
</script>

<template>
  <!-- Loading -->
  <div v-if="loading && !hasAny" class="flex items-center justify-center py-20 gap-3" role="status">
    <div
      class="w-5 h-5 border-2 border-[var(--color-surface-container-high)] border-t-[var(--color-primary)] rounded-full animate-spin"
      aria-hidden="true"
    ></div>
    <span class="text-sm text-[var(--color-on-surface-variant)]">Cargando semana...</span>
  </div>

  <!-- Wide grid scrolls inside its own container: the page never scrolls horizontally -->
  <div v-else class="overflow-x-auto pb-2">
    <div class="min-w-[720px] md:min-w-[900px]">
      <!-- Day headers -->
      <div class="grid grid-cols-7 mb-4 gap-2 md:gap-4">
        <div v-for="wd in weekDays" :key="wd.date" class="text-center py-2">
          <span
            class="block text-xs font-bold uppercase tracking-wider"
            :class="
              wd.isToday
                ? 'text-[var(--color-primary)]'
                : wd.isSunday
                  ? 'text-red-400'
                  : 'text-[var(--color-on-surface-variant)]/60'
            "
            >{{ wd.dayName }}</span
          >
          <span
            class="inline-block text-xl md:text-2xl font-bold mt-1"
            :class="
              wd.isToday ? 'text-[var(--color-primary)] bg-blue-50 px-3 py-1 rounded-full' : ''
            "
            :aria-current="wd.isToday ? 'date' : undefined"
            >{{ wd.dayNumber }}</span
          >
        </div>
      </div>

      <!-- 7-column grid -->
      <div class="grid grid-cols-7 gap-2 md:gap-4">
        <div
          v-for="wd in weekDays"
          :key="wd.date"
          class="min-h-[320px] md:min-h-[500px] rounded-xl p-2 md:p-3 space-y-2 md:space-y-3"
          :class="
            wd.isToday
              ? 'bg-[var(--color-primary)]/5 border border-[var(--color-primary)]/10'
              : 'bg-[var(--color-surface-container-low)]'
          "
        >
          <template v-if="(appointmentsByDate.get(wd.date)?.length ?? 0) > 0">
            <button
              v-for="appt in appointmentsByDate.get(wd.date)"
              :key="appt.id"
              class="w-full text-left bg-white p-3 rounded-xl shadow-sm border border-[var(--color-outline-variant)]/10 hover:shadow-md transition-shadow cursor-pointer"
              :class="appt.status === 'CANCELLED' ? 'opacity-50' : ''"
              @click="emit('select-day', wd.date)"
            >
              <span
                class="text-[10px] font-bold uppercase"
                :class="
                  wd.isToday
                    ? 'text-[var(--color-primary)]'
                    : 'text-[var(--color-on-surface-variant)]/70'
                "
              >
                {{ formatTime(appt.startTime, timezone) }} -
                {{ formatTime(appt.endTime, timezone) }}
              </span>
              <h4
                class="font-bold text-sm mt-1 text-[var(--color-on-surface)]"
                :class="appt.status === 'CANCELLED' ? 'line-through' : ''"
              >
                {{ appt.clientName }}
              </h4>
              <p class="text-xs text-[var(--color-on-surface-variant)]">{{ appt.service.name }}</p>
              <div class="mt-2 flex items-center gap-1.5">
                <div
                  class="w-2 h-2 rounded-full"
                  :class="employeeColorByName.get(appt.employee.name) || 'bg-slate-400'"
                  aria-hidden="true"
                ></div>
                <span class="text-[10px] font-medium text-[var(--color-on-surface-variant)]">{{
                  appt.employee.name.split(' ')[0]
                }}</span>
              </div>
            </button>
          </template>
          <div v-else class="h-full flex items-center justify-center">
            <span
              v-if="wd.isSunday"
              class="material-symbols-outlined text-2xl text-[var(--color-outline-variant)]/30"
              aria-hidden="true"
              >event_busy</span
            >
            <p v-else class="text-xs text-[var(--color-on-surface-variant)]/40">Sin citas</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
