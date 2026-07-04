<script setup lang="ts">
defineProps<{
  current: number;
  total: number;
}>();
</script>

<template>
  <div class="flex items-center gap-2 px-4 py-3">
    <span class="text-xs font-bold uppercase tracking-wider text-[var(--color-primary)]">
      PASO {{ current }} de {{ total }}
    </span>
    <div
      class="flex-1 h-1.5 bg-[var(--color-surface-container-high)] rounded-full overflow-hidden"
      role="progressbar"
      :aria-valuenow="current"
      :aria-valuemin="1"
      :aria-valuemax="total"
      :aria-label="`Paso ${current} de ${total}`"
    >
      <div
        class="h-full bg-[var(--color-primary)] rounded-full transition-all duration-500 ease-out"
        :style="{ width: `${(current / total) * 100}%` }"
      />
    </div>
    <span class="text-xs font-medium text-[var(--color-on-surface-variant)]">
      {{ Math.round((current / total) * 100) }}%
    </span>
  </div>
</template>
