<script setup lang="ts">
import { formatTime } from '@agendly/shared';
import type { CalendarAppointment } from '~/composables/useAppointmentsCalendar';

defineProps<{
  appointment: CalendarAppointment;
  borderClass: string;
}>();

const emit = defineEmits<{
  'update-status': [status: 'COMPLETED' | 'NO_SHOW' | 'CANCELLED'];
}>();

const statusConfig: Record<string, { label: string; class: string }> = {
  CONFIRMED: { label: 'Confirmada', class: 'bg-blue-50 text-[var(--color-primary)] border border-blue-100' },
  COMPLETED: { label: 'Completada', class: 'bg-emerald-50 text-emerald-700 border border-emerald-100' },
  CANCELLED: { label: 'Cancelada', class: 'bg-red-50 text-red-700 border border-red-100' },
  NO_SHOW: { label: 'No asistió', class: 'bg-amber-50 text-amber-700 border border-amber-100' },
};

function serviceIcon(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes('corte')) return 'content_cut';
  if (lower.includes('manicure') || lower.includes('uña')) return 'spa';
  if (lower.includes('tinte') || lower.includes('color')) return 'brush';
  return 'auto_awesome';
}
</script>

<template>
  <div
    class="flex items-start gap-3 md:gap-4 p-4 rounded-xl border-l-4 transition-colors hover:bg-[var(--color-surface-container-low)]/50 group"
    :class="[borderClass, appointment.status === 'CONFIRMED' ? 'bg-blue-50/20' : 'bg-[var(--color-surface-container-low)]/30']"
  >
    <div class="p-2.5 bg-white rounded-xl shadow-sm shrink-0 hidden sm:block">
      <span class="material-symbols-outlined text-[var(--color-on-surface-variant)] text-xl" aria-hidden="true">
        {{ serviceIcon(appointment.service.name) }}
      </span>
    </div>
    <div class="flex-1 min-w-0">
      <div class="flex items-center gap-2 flex-wrap">
        <h4 class="text-sm font-bold text-[var(--color-on-surface)]">{{ appointment.clientName }}</h4>
        <span
          v-if="statusConfig[appointment.status]"
          class="text-[10px] px-2 py-0.5 rounded-full font-bold"
          :class="statusConfig[appointment.status]?.class"
        >{{ statusConfig[appointment.status]?.label }}</span>
      </div>
      <p class="text-xs text-[var(--color-on-surface-variant)] font-medium mt-0.5">{{ appointment.service.name }}</p>
      <div class="flex items-center gap-3 mt-2 flex-wrap">
        <span class="text-[10px] px-2 py-0.5 bg-white/80 rounded-full font-bold text-[var(--color-on-surface-variant)] flex items-center gap-1 border border-[var(--color-outline-variant)]/20">
          <span class="material-symbols-outlined text-[12px]" aria-hidden="true">schedule</span>
          {{ formatTime(appointment.startTime) }} — {{ formatTime(appointment.endTime) }}
        </span>
        <span class="text-xs text-[var(--color-outline)]">{{ appointment.clientPhone }}</span>
      </div>
    </div>
    <div class="flex flex-col sm:flex-row items-end sm:items-center gap-2 shrink-0">
      <div
        class="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
        :class="colorForName(appointment.employee.name)"
        :title="appointment.employee.name"
      >
        {{ getInitials(appointment.employee.name) }}
      </div>
      <div
        v-if="appointment.status === 'CONFIRMED'"
        class="flex gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
      >
        <button
          class="text-[10px] px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-100 font-semibold hover:bg-emerald-100 transition-colors"
          @click="emit('update-status', 'COMPLETED')"
        >Completar</button>
        <button
          class="text-[10px] px-2 py-1 rounded-lg bg-amber-50 text-amber-700 border border-amber-100 font-semibold hover:bg-amber-100 transition-colors"
          @click="emit('update-status', 'NO_SHOW')"
        >No asistió</button>
        <button
          class="text-[10px] px-2 py-1 rounded-lg bg-red-50 text-red-700 border border-red-100 font-semibold hover:bg-red-100 transition-colors"
          @click="emit('update-status', 'CANCELLED')"
        >Cancelar</button>
      </div>
    </div>
  </div>
</template>
