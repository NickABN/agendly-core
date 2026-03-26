<script setup lang="ts">
defineProps<{
  name: string;
  durationMinutes: number;
  price: string;
  selected?: boolean;
}>();

defineEmits<{
  select: [];
}>();
</script>

<template>
  <button
    class="w-full flex items-center gap-4 p-5 rounded-xl border-2 transition-all duration-200 text-left active:scale-[0.98]"
    :class="selected
      ? 'border-[var(--color-primary)] bg-blue-50/40'
      : 'border-[var(--color-outline-variant)]/30 bg-white hover:border-[var(--color-primary)]/40 hover:bg-[var(--color-surface-container-low)]'"
    @click="$emit('select')"
  >
    <!-- Icon circle -->
    <div
      class="w-14 h-14 rounded-xl flex items-center justify-center shrink-0"
      :class="selected ? 'bg-[var(--color-primary)]/10' : 'bg-[var(--color-surface-container-high)]'"
    >
      <span
        class="material-symbols-outlined text-2xl"
        :class="selected ? 'text-[var(--color-primary)]' : 'text-[var(--color-on-surface-variant)]'"
      >content_cut</span>
    </div>

    <!-- Info -->
    <div class="flex-1 min-w-0">
      <p class="font-semibold text-[var(--color-on-surface)] text-base leading-tight">{{ name }}</p>
      <div class="flex items-center gap-1 mt-1">
        <span class="material-symbols-outlined text-sm text-[var(--color-on-surface-variant)]">schedule</span>
        <span class="text-sm text-[var(--color-on-surface-variant)]">{{ durationMinutes }} min</span>
      </div>
    </div>

    <!-- Price + selection -->
    <div class="flex flex-col items-end gap-1 shrink-0">
      <span class="text-xl font-bold text-[var(--color-on-surface)]">${{ price }}</span>
      <span class="text-xs text-[var(--color-on-surface-variant)]">MXN</span>
    </div>

    <!-- Selected checkmark -->
    <div v-if="selected" class="shrink-0">
      <span class="material-symbols-outlined text-[var(--color-primary)]" style="font-variation-settings: 'FILL' 1">check_circle</span>
    </div>
  </button>
</template>
