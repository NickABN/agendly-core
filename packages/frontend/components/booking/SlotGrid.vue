<script setup lang="ts">
import { BUSINESS_TZ, formatTime } from '@agendly/shared';

const props = withDefaults(
  defineProps<{
    slots: Array<{ start: string; end: string }>;
    modelValue: string;
    loading: boolean;
    hasDate: boolean;
    /** IANA timezone of the business — slot labels render its wall clock. */
    timezone?: string;
  }>(),
  { timezone: BUSINESS_TZ },
);

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();

const lowAvailability = computed(() => {
  if (!props.slots.length) return null;
  if (props.slots.length <= 2) return props.slots.length;
  return null;
});
</script>

<template>
  <!-- Loading -->
  <div v-if="loading" class="flex items-center justify-center py-8 gap-3" role="status">
    <div
      class="w-5 h-5 border-2 border-[var(--color-surface-container-high)] border-t-[var(--color-primary)] rounded-full animate-spin"
      aria-hidden="true"
    />
    <span class="text-sm text-[var(--color-on-surface-variant)]">Cargando horarios...</span>
  </div>

  <template v-else-if="slots.length > 0">
    <!-- Urgency banner -->
    <div
      v-if="lowAvailability"
      class="mb-4 flex items-center gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200/60"
    >
      <span class="material-symbols-outlined text-amber-600 text-lg">bolt</span>
      <p class="text-sm font-semibold text-amber-800">
        <template v-if="lowAvailability === 1">¡Último horario disponible hoy!</template>
        <template v-else>Últimos {{ lowAvailability }} horarios disponibles hoy</template>
      </p>
    </div>

    <!-- Slots grid -->
    <div class="grid grid-cols-2 gap-3">
      <button
        v-for="slot in slots"
        :key="slot.start"
        class="relative group flex flex-col items-center justify-center gap-1 p-4 rounded-xl border-2 transition-all duration-200 active:scale-[0.97]"
        :class="
          modelValue === slot.start
            ? 'bg-[var(--color-primary)] border-[var(--color-primary)] text-white shadow-md shadow-[var(--color-primary)]/20'
            : 'bg-white border-[var(--color-outline-variant)]/30 hover:border-[var(--color-primary)]/40'
        "
        :aria-pressed="modelValue === slot.start"
        @click="emit('update:modelValue', slot.start)"
      >
        <!-- Selected checkmark badge -->
        <span
          v-if="modelValue === slot.start"
          class="absolute -top-1.5 -right-1.5 material-symbols-outlined text-white bg-[var(--color-primary)] rounded-full text-base"
          style="font-variation-settings: 'FILL' 1"
          >check_circle</span
        >

        <span
          class="text-lg font-bold leading-none"
          :class="modelValue === slot.start ? 'text-white' : 'text-[var(--color-on-surface)]'"
          >{{ formatTime(slot.start, timezone) }}</span
        >
        <span
          class="text-[10px] font-bold uppercase tracking-widest"
          :class="modelValue === slot.start ? 'text-white/70' : 'text-emerald-600'"
          >{{ modelValue === slot.start ? 'Seleccionado' : 'Disponible' }}</span
        >
      </button>
    </div>
  </template>

  <!-- No slots -->
  <div v-else-if="hasDate && !loading" class="text-center py-8 space-y-2">
    <span class="material-symbols-outlined text-[var(--color-outline-variant)] text-4xl"
      >event_busy</span
    >
    <p class="text-[var(--color-on-surface-variant)] text-sm font-medium">
      No hay horarios disponibles para esta fecha
    </p>
    <p class="text-xs text-[var(--color-outline)]">Intenta con otro día</p>
  </div>
</template>
