<script setup lang="ts">
import type { CalendarView } from '~/composables/useCalendarNav';

defineProps<{
  view: CalendarView;
  label: string;
  isToday: boolean;
}>();

const emit = defineEmits<{
  'update:view': [view: CalendarView];
  prev: [];
  next: [];
  today: [];
  'new-appointment': [];
  logout: [];
}>();

const viewLabels: Record<CalendarView, string> = {
  day: 'Día',
  week: 'Semana',
  month: 'Mes',
};
</script>

<template>
  <header
    class="flex flex-wrap items-center gap-y-2 justify-between px-3 md:px-6 py-2 md:h-16 bg-white/80 backdrop-blur-md border-b border-[var(--color-outline-variant)]/10 sticky top-0 z-40 shrink-0"
  >
    <!-- Left: Nav + view toggle -->
    <div class="flex flex-wrap items-center gap-2 md:gap-4">
      <div class="flex items-center gap-1 md:gap-2">
        <button
          class="p-1.5 hover:bg-[var(--color-surface-container-high)] rounded-full transition-colors"
          aria-label="Anterior"
          @click="emit('prev')"
        >
          <span class="material-symbols-outlined text-lg" aria-hidden="true">chevron_left</span>
        </button>
        <h2 class="text-sm font-bold text-[var(--color-on-surface)] min-w-[140px] md:min-w-[200px] text-center capitalize">
          {{ label }}
        </h2>
        <button
          class="p-1.5 hover:bg-[var(--color-surface-container-high)] rounded-full transition-colors"
          aria-label="Siguiente"
          @click="emit('next')"
        >
          <span class="material-symbols-outlined text-lg" aria-hidden="true">chevron_right</span>
        </button>
        <button
          v-if="view === 'day' && !isToday"
          class="text-xs font-semibold text-[var(--color-primary)] px-3 py-1.5 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
          @click="emit('today')"
        >Hoy</button>
      </div>

      <!-- View mode toggle -->
      <div class="flex p-1 bg-[var(--color-surface-container-low)] rounded-xl" role="group" aria-label="Cambiar vista">
        <button
          v-for="mode in (['day', 'week', 'month'] as CalendarView[])"
          :key="mode"
          class="px-3 py-1.5 text-xs font-semibold rounded-lg transition-all"
          :class="
            view === mode
              ? 'bg-white shadow-sm text-[var(--color-primary)]'
              : 'text-[var(--color-on-surface-variant)] hover:text-[var(--color-on-surface)]'
          "
          :aria-pressed="view === mode"
          @click="emit('update:view', mode)"
        >
          {{ viewLabels[mode] }}
        </button>
      </div>
    </div>

    <!-- Right: Actions -->
    <div class="flex items-center gap-2 md:gap-3">
      <button
        class="bg-[var(--color-primary)] text-white px-3 md:px-5 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 hover:bg-[var(--color-primary-container)] transition-colors"
        @click="emit('new-appointment')"
      >
        <span class="material-symbols-outlined text-lg" aria-hidden="true">add</span>
        <span class="hidden sm:inline">Nueva Cita</span>
      </button>
      <button
        class="p-2 text-[var(--color-on-surface-variant)] hover:text-red-500 transition-colors"
        aria-label="Cerrar sesión"
        @click="emit('logout')"
      >
        <span class="material-symbols-outlined" aria-hidden="true">logout</span>
      </button>
    </div>
  </header>
</template>
