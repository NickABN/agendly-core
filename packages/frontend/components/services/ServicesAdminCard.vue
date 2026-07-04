<script setup lang="ts">
import type { ServiceItem } from '~/composables/useServices';

defineProps<{
  service: ServiceItem;
  index: number;
}>();

const emit = defineEmits<{
  edit: [];
  remove: [];
  availability: [];
}>();

function serviceIcon(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes('corte') || lower.includes('cabello')) return 'content_cut';
  if (lower.includes('manicure') || lower.includes('uña')) return 'spa';
  if (lower.includes('barba')) return 'face';
  if (lower.includes('color') || lower.includes('tinte') || lower.includes('tint')) return 'palette';
  if (lower.includes('masaje') || lower.includes('relaj')) return 'self_improvement';
  if (lower.includes('facial')) return 'face_retouching_natural';
  if (lower.includes('pedicure') || lower.includes('pie')) return 'podiatry';
  return 'content_cut';
}

const iconColors = [
  { bg: 'bg-emerald-50', text: 'text-emerald-600' },
  { bg: 'bg-orange-50', text: 'text-orange-600' },
  { bg: 'bg-blue-50', text: 'text-blue-600' },
  { bg: 'bg-violet-50', text: 'text-violet-600' },
  { bg: 'bg-pink-50', text: 'text-pink-600' },
  { bg: 'bg-teal-50', text: 'text-teal-600' },
];
</script>

<template>
  <div
    class="group bg-white rounded-xl p-6 shadow-sm border border-[var(--color-outline-variant)]/10 transition-all duration-200 hover:shadow-md hover:border-[var(--color-primary)]/20 relative overflow-hidden"
  >
    <!-- Icon + actions -->
    <div class="flex justify-between items-start mb-4">
      <div
        class="p-2.5 rounded-lg"
        :class="[iconColors[index % iconColors.length].bg, iconColors[index % iconColors.length].text]"
      >
        <span class="material-symbols-outlined" aria-hidden="true">{{ serviceIcon(service.name) }}</span>
      </div>
      <div class="flex gap-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
        <button
          class="p-2 text-[var(--color-outline)] hover:bg-[var(--color-surface-container-high)] rounded-full transition-colors"
          :aria-label="`Disponibilidad de ${service.name}`"
          @click="emit('availability')"
        >
          <span class="material-symbols-outlined text-base" aria-hidden="true">calendar_month</span>
        </button>
        <button
          class="p-2 text-[var(--color-outline)] hover:bg-[var(--color-surface-container-high)] rounded-full transition-colors"
          :aria-label="`Editar ${service.name}`"
          @click="emit('edit')"
        >
          <span class="material-symbols-outlined text-base" aria-hidden="true">edit</span>
        </button>
        <button
          class="p-2 text-red-400 hover:bg-red-50 rounded-full transition-colors"
          :aria-label="`Eliminar ${service.name}`"
          @click="emit('remove')"
        >
          <span class="material-symbols-outlined text-base" aria-hidden="true">delete</span>
        </button>
      </div>
    </div>

    <!-- Name + badge -->
    <div class="flex items-center justify-between mb-1">
      <h3 class="text-lg font-bold text-[var(--color-on-surface)]">{{ service.name }}</h3>
      <span
        class="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full"
        :class="
          service.isActive
            ? 'text-emerald-700 bg-emerald-50 border border-emerald-100'
            : 'text-slate-500 bg-slate-50 border border-slate-200'
        "
      >
        {{ service.isActive ? 'Activo' : 'Pausado' }}
      </span>
    </div>

    <!-- Duration + Price -->
    <div class="pt-4 mt-3 flex items-center justify-between border-t border-[var(--color-outline-variant)]/10">
      <div class="flex items-center gap-2 text-[var(--color-on-surface-variant)]">
        <span class="material-symbols-outlined text-lg" aria-hidden="true">schedule</span>
        <span class="text-sm font-medium">{{ service.durationMinutes }} min</span>
      </div>
      <div class="text-2xl font-black text-[var(--color-primary)]">${{ service.priceMXN }}</div>
    </div>
  </div>
</template>
