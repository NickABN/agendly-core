<script setup lang="ts">
defineProps<{
  employees: Array<{ id: string; name: string }>;
  modelValue: string;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();

function getInitials(name: string) {
  return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
}

const avatarColors = [
  'bg-violet-400', 'bg-emerald-500', 'bg-blue-500', 'bg-orange-400',
  'bg-pink-400', 'bg-teal-500', 'bg-rose-400', 'bg-cyan-500',
];

function getColor(index: number) {
  return avatarColors[index % avatarColors.length];
}
</script>

<template>
  <div class="space-y-3">
    <!-- Any available option -->
    <button
      class="w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all duration-200 active:scale-[0.98]"
      :class="modelValue === 'any'
        ? 'border-[var(--color-primary)] bg-blue-50/40'
        : 'border-[var(--color-outline-variant)]/30 bg-white hover:border-[var(--color-primary)]/30'"
      @click="emit('update:modelValue', 'any')"
    >
      <div class="w-12 h-12 rounded-full bg-[var(--color-surface-container-high)] flex items-center justify-center shrink-0">
        <span class="material-symbols-outlined text-[var(--color-on-surface-variant)]">group</span>
      </div>
      <div class="flex-1 text-left">
        <p class="font-semibold text-[var(--color-on-surface)]">Cualquier disponible</p>
        <p class="text-sm text-[var(--color-on-surface-variant)]">El primero disponible en tu horario</p>
      </div>
      <span
        v-if="modelValue === 'any'"
        class="material-symbols-outlined text-[var(--color-primary)] shrink-0"
        style="font-variation-settings: 'FILL' 1"
      >check_circle</span>
      <span v-else class="material-symbols-outlined text-[var(--color-outline-variant)] shrink-0">chevron_right</span>
    </button>

    <!-- Individual employees -->
    <button
      v-for="(e, idx) in employees"
      :key="e.id"
      class="w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all duration-200 active:scale-[0.98]"
      :class="modelValue === e.id
        ? 'border-[var(--color-primary)] bg-blue-50/40'
        : 'border-[var(--color-outline-variant)]/30 bg-white hover:border-[var(--color-primary)]/30'"
      @click="emit('update:modelValue', e.id)"
    >
      <div
        class="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold shrink-0"
        :class="getColor(idx)"
      >
        {{ getInitials(e.name) }}
      </div>
      <div class="flex-1 text-left">
        <p class="font-semibold text-[var(--color-on-surface)]">{{ e.name }}</p>
        <div class="flex items-center gap-1 mt-0.5">
          <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
          <span class="text-xs font-medium text-emerald-600">Disponible</span>
        </div>
      </div>
      <span
        v-if="modelValue === e.id"
        class="material-symbols-outlined text-[var(--color-primary)] shrink-0"
        style="font-variation-settings: 'FILL' 1"
      >check_circle</span>
      <span v-else class="material-symbols-outlined text-[var(--color-outline-variant)] shrink-0">chevron_right</span>
    </button>
  </div>
</template>
