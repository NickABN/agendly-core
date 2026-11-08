<script setup lang="ts">
import { formatMXNPrice, formatServiceDuration } from '~/utils/onboardingServices';

interface ServicePreview {
  name: string;
  durationMinutes: number;
  priceMXN: number;
}

const props = defineProps<{ services: ServicePreview[] }>();

const visibleServices = computed(() => props.services.filter((service) => service.name.trim()));
</script>

<template>
  <section class="space-y-3" aria-label="Servicios disponibles">
    <h3 class="text-sm font-bold">Servicios</h3>
    <ul v-if="visibleServices.length" class="space-y-2">
      <li
        v-for="(service, index) in visibleServices"
        :key="`${service.name}-${index}`"
        class="rounded-xl border border-[var(--color-outline-variant)]/20 bg-white p-3 shadow-sm"
      >
        <p class="truncate text-sm font-semibold">{{ service.name }}</p>
        <div
          class="mt-2 flex items-center justify-between gap-2 text-xs text-[var(--color-on-surface-variant)]"
        >
          <span>{{ formatServiceDuration(service.durationMinutes) }}</span>
          <span class="font-semibold text-[var(--color-on-surface)]">
            {{ formatMXNPrice(service.priceMXN) }}
          </span>
        </div>
      </li>
    </ul>
    <p
      v-else
      class="rounded-xl border border-dashed border-[var(--color-outline-variant)]/40 px-3 py-4 text-center text-xs text-[var(--color-on-surface-variant)]"
    >
      Tus servicios aparecerán aquí cuando agregues uno.
    </p>
  </section>
</template>
