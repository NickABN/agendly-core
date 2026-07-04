<script setup lang="ts">
import { addDays, dayOfWeekOf, todayKey } from '@agendly/shared';

const props = defineProps<{
  modelValue: string;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();

const DAY_NAMES: Record<string, string> = {
  MONDAY: 'Lun',
  TUESDAY: 'Mar',
  WEDNESDAY: 'Mié',
  THURSDAY: 'Jue',
  FRIDAY: 'Vie',
  SATURDAY: 'Sáb',
  SUNDAY: 'Dom',
};
const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

// The 7-day window starts at "today" in the BUSINESS timezone, not the
// visitor's — a customer browsing from another country sees the salon's days.
const days = computed(() => {
  const start = todayKey();
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(start, i);
    const [, month, day] = date.split('-').map(Number);
    return {
      date,
      dayName: i === 0 ? 'Hoy' : DAY_NAMES[dayOfWeekOf(date)],
      dayNumber: String(day),
      monthName: MONTH_NAMES[month - 1],
      isToday: i === 0,
    };
  });
});
</script>

<template>
  <div class="flex gap-2 overflow-x-auto pb-2 scrollbar-hide" role="group" aria-label="Elegir día">
    <button
      v-for="day in days"
      :key="day.date"
      class="flex-shrink-0 w-[72px] h-[84px] rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all duration-200 active:scale-[0.97]"
      :class="modelValue === day.date
        ? 'bg-[var(--color-primary)] text-white shadow-md shadow-[var(--color-primary)]/20'
        : 'bg-white border border-[var(--color-outline-variant)]/30 text-[var(--color-on-surface)] hover:border-[var(--color-primary)]/40'"
      :aria-pressed="modelValue === day.date"
      @click="emit('update:modelValue', day.date)"
    >
      <span
        class="text-[10px] font-bold uppercase tracking-wider"
        :class="modelValue === day.date ? 'text-white/70' : 'text-[var(--color-on-surface-variant)]'"
      >{{ day.dayName }}</span>
      <span class="text-2xl font-bold leading-none">{{ day.dayNumber }}</span>
      <span
        class="text-[10px] font-medium"
        :class="modelValue === day.date ? 'text-white/70' : 'text-[var(--color-on-surface-variant)]'"
      >{{ day.monthName }}</span>
    </button>
  </div>
</template>

<style scoped>
.scrollbar-hide::-webkit-scrollbar { display: none; }
.scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
</style>
