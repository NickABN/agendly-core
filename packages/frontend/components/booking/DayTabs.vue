<script setup lang="ts">
const props = defineProps<{
  modelValue: string;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();

function toLocalDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const days = computed(() => {
  const result: Array<{ date: string; dayName: string; dayNumber: string; monthName: string; isToday: boolean }> = [];
  const today = new Date();
  const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    result.push({
      date: toLocalDateStr(d),
      dayName: i === 0 ? 'Hoy' : dayNames[d.getDay()],
      dayNumber: String(d.getDate()),
      monthName: monthNames[d.getMonth()],
      isToday: i === 0,
    });
  }
  return result;
});
</script>

<template>
  <div class="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
    <button
      v-for="day in days"
      :key="day.date"
      class="flex-shrink-0 w-[72px] h-[84px] rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all duration-200 active:scale-[0.97]"
      :class="modelValue === day.date
        ? 'bg-[var(--color-primary)] text-white shadow-md shadow-[var(--color-primary)]/20'
        : 'bg-white border border-[var(--color-outline-variant)]/30 text-[var(--color-on-surface)] hover:border-[var(--color-primary)]/40'"
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
