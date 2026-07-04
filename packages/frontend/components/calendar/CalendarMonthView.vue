<script setup lang="ts">
import { formatDateKey } from '@agendly/shared';
import type { MonthDensity } from '~/composables/useAppointmentsCalendar';

const props = defineProps<{
  monthDays: Array<{ date: string; day: number; currentMonth: boolean; isToday: boolean }>;
  density: MonthDensity;
  loading: boolean;
}>();

const emit = defineEmits<{
  'go-to-day': [date: string];
}>();

/** Cell tapped: on desktop shows the side detail; a second tap (or mobile sheet button) navigates. */
const detailDate = ref('');

function onCellClick(date: string, currentMonth: boolean) {
  if (!currentMonth) return;
  detailDate.value = date;
}

const detailInfo = computed(() =>
  detailDate.value ? props.density[detailDate.value] : undefined,
);
</script>

<template>
  <div v-if="loading && Object.keys(density).length === 0" class="flex items-center justify-center py-20 gap-3" role="status">
    <div class="w-5 h-5 border-2 border-[var(--color-surface-container-high)] border-t-[var(--color-primary)] rounded-full animate-spin" aria-hidden="true"></div>
    <span class="text-sm text-[var(--color-on-surface-variant)]">Cargando mes...</span>
  </div>

  <div v-else class="flex flex-col lg:flex-row gap-6">
    <!-- Calendar grid -->
    <div class="flex-1 min-w-0">
      <!-- Weekday headers -->
      <div class="grid grid-cols-7 mb-4">
        <div
          v-for="dayName in ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']"
          :key="dayName"
          class="text-center text-xs font-bold text-[var(--color-on-surface-variant)] tracking-widest uppercase py-2"
        >{{ dayName }}</div>
      </div>

      <!-- Days grid -->
      <div class="grid grid-cols-7 bg-[var(--color-outline-variant)]/10 gap-[1px] rounded-xl overflow-hidden border border-[var(--color-outline-variant)]/20 shadow-sm">
        <button
          v-for="cd in monthDays"
          :key="cd.date"
          class="min-h-[64px] md:min-h-[120px] p-1.5 md:p-3 flex flex-col text-left transition-colors"
          :class="[
            cd.currentMonth ? 'bg-white hover:bg-[var(--color-surface-container-lowest)] cursor-pointer' : 'bg-[var(--color-surface-container-low)] opacity-40 cursor-default',
            cd.isToday ? 'border-2 border-[var(--color-primary)] bg-[var(--color-primary)]/5' : '',
            detailDate === cd.date ? 'ring-2 ring-[var(--color-primary)]/40' : '',
          ]"
          :aria-label="`${formatDateKey(cd.date)}${density[cd.date] ? `, ${density[cd.date].count} citas` : ', sin citas'}`"
          :aria-current="cd.isToday ? 'date' : undefined"
          @click="onCellClick(cd.date, cd.currentMonth)"
        >
          <div class="flex items-center justify-between mb-1 md:mb-2 w-full">
            <span class="text-xs md:text-sm font-semibold" :class="cd.isToday ? 'text-[var(--color-primary)] font-bold' : ''">{{ cd.day }}</span>
            <span
              v-if="cd.isToday"
              class="hidden md:inline text-[9px] uppercase font-black text-[var(--color-primary)] bg-blue-50 px-1.5 py-0.5 rounded"
            >Hoy</span>
          </div>
          <!-- Appointment dots -->
          <div v-if="density[cd.date]" class="mt-auto flex flex-wrap gap-1 justify-end items-end w-full">
            <div
              v-for="emp in density[cd.date].employees.slice(0, 3)"
              :key="emp"
              class="w-2 md:w-2.5 h-2 md:h-2.5 rounded-full"
              :class="colorForName(emp)"
              :title="emp"
            ></div>
            <span
              v-if="density[cd.date].count > 3"
              class="text-[10px] font-bold text-[var(--color-on-surface-variant)] leading-none"
            >+{{ density[cd.date].count - 3 }}</span>
          </div>
        </button>
      </div>
    </div>

    <!-- Day detail: sidebar on lg+, inline card below the grid on mobile -->
    <aside
      v-if="detailDate && detailInfo"
      class="w-full lg:w-80 bg-white border border-[var(--color-outline-variant)]/20 rounded-xl shadow-sm overflow-hidden flex flex-col shrink-0"
    >
      <div class="p-5 md:p-6 border-b border-[var(--color-outline-variant)]/20">
        <h3 class="text-xl md:text-2xl font-extrabold text-[var(--color-on-surface)] capitalize">
          {{ formatDateKey(detailDate) }}
        </h3>
        <p class="text-sm text-[var(--color-on-surface-variant)] mt-1">
          {{ detailInfo.count }} {{ detailInfo.count === 1 ? 'cita' : 'citas' }}
        </p>
      </div>
      <div class="p-4">
        <button
          class="w-full py-2.5 text-sm font-semibold text-[var(--color-primary)] bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
          @click="emit('go-to-day', detailDate)"
        >
          Ver detalle del día →
        </button>
      </div>
    </aside>
  </div>
</template>
