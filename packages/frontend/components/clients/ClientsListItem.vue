<script setup lang="ts">
import { formatDate } from '@agendly/shared';
import type { ClientItem } from '~/composables/useClients';

defineProps<{
  client: ClientItem;
  index: number;
}>();

const timezone = useBusinessTimezone();

function formatPhone(phone: string) {
  // Format Mexican phone numbers: 55 1234 5678
  if (phone.length === 10) {
    return `${phone.slice(0, 2)} ${phone.slice(2, 6)} ${phone.slice(6)}`;
  }
  return phone;
}
</script>

<template>
  <div
    class="group flex items-center gap-4 md:gap-5 p-4 md:p-5 bg-white rounded-xl shadow-sm border border-[var(--color-outline-variant)]/10 transition-all duration-200 hover:shadow-md hover:border-[var(--color-primary)]/20"
  >
    <!-- Avatar -->
    <div
      class="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
      :class="colorForIndex(index)"
    >
      {{ getInitials(client.name) }}
    </div>

    <!-- Info -->
    <div class="flex-1 min-w-0">
      <div class="flex items-center gap-3 mb-0.5">
        <h3 class="font-bold text-[var(--color-on-surface)] truncate">{{ client.name }}</h3>
        <span
          v-if="client.totalVisits >= 5"
          class="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full text-amber-700 bg-amber-50 border border-amber-100 shrink-0"
        >
          <span
            class="material-symbols-outlined text-[10px] align-middle mr-0.5"
            style="font-variation-settings: 'FILL' 1"
            aria-hidden="true"
            >star</span
          >
          Frecuente
        </span>
      </div>
      <div class="flex items-center gap-4 text-sm text-[var(--color-on-surface-variant)]">
        <span class="flex items-center gap-1">
          <span class="material-symbols-outlined text-sm" aria-hidden="true">phone</span>
          {{ formatPhone(client.phone) }}
        </span>
        <span v-if="client.email" class="hidden sm:flex items-center gap-1 truncate">
          <span class="material-symbols-outlined text-sm" aria-hidden="true">mail</span>
          {{ client.email }}
        </span>
      </div>
    </div>

    <!-- Service + visits -->
    <div class="hidden md:flex flex-col items-end gap-1 shrink-0">
      <span class="text-xs font-medium text-[var(--color-on-surface-variant)]">{{
        client.topService
      }}</span>
      <span class="text-xs text-[var(--color-outline)]"
        >Última: {{ formatDate(client.lastVisit, 'short', timezone) }}</span
      >
    </div>

    <!-- Visit count -->
    <div
      class="flex flex-col items-center justify-center px-3 md:px-4 py-2 rounded-xl bg-[var(--color-surface-container-low)] shrink-0"
    >
      <span class="text-xl font-black text-[var(--color-primary)]">{{ client.totalVisits }}</span>
      <span
        class="text-[10px] font-semibold text-[var(--color-on-surface-variant)] uppercase tracking-wider"
      >
        {{ client.totalVisits === 1 ? 'Visita' : 'Visitas' }}
      </span>
    </div>
  </div>
</template>
