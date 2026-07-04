<script setup lang="ts">
import type { CalendarAppointment } from '~/composables/useAppointmentsCalendar';

defineProps<{
  appointments: CalendarAppointment[];
  loading: boolean;
  isToday: boolean;
  slug: string;
}>();

const emit = defineEmits<{
  'update-status': [id: string, status: 'COMPLETED' | 'NO_SHOW' | 'CANCELLED'];
}>();

const copied = ref(false);

async function copyPublicUrl(slug: string) {
  try {
    await navigator.clipboard.writeText(`https://agendly.mx/${slug}`);
    copied.value = true;
    setTimeout(() => (copied.value = false), 2000);
  } catch {
    // clipboard unavailable (http/permissions) — no-op
  }
}
</script>

<template>
  <div>
    <div class="mb-6 md:mb-8">
      <p class="text-sm font-medium text-[var(--color-on-surface-variant)]">Vista Consolidada del Salón</p>
    </div>

    <!-- Loading -->
    <div v-if="loading && appointments.length === 0" class="flex items-center justify-center py-20 gap-3" role="status">
      <div class="w-5 h-5 border-2 border-[var(--color-surface-container-high)] border-t-[var(--color-primary)] rounded-full animate-spin" aria-hidden="true"></div>
      <span class="text-sm text-[var(--color-on-surface-variant)]">Cargando citas...</span>
    </div>

    <!-- Empty -->
    <div v-else-if="appointments.length === 0" class="flex flex-col items-center justify-center py-20 text-center space-y-3">
      <span class="material-symbols-outlined text-5xl text-[var(--color-outline-variant)]" aria-hidden="true">calendar_today</span>
      <p class="text-lg font-semibold text-[var(--color-on-surface)]">
        {{ isToday ? 'No hay citas para hoy' : 'No hay citas para este día' }}
      </p>
      <p class="text-sm text-[var(--color-on-surface-variant)] max-w-sm">
        Comparte tu enlace:
        <span class="font-bold text-[var(--color-primary)]">agendly.mx/{{ slug }}</span>
      </p>
    </div>

    <!-- Appointment list -->
    <div v-else class="bg-[var(--color-surface-container-lowest)] rounded-2xl editorial-shadow overflow-hidden">
      <div class="p-3 md:p-6 space-y-3">
        <CalendarAppointmentCard
          v-for="(appt, index) in appointments"
          :key="appt.id"
          :appointment="appt"
          :border-class="borderColorForIndex(index)"
          @update-status="(status) => emit('update-status', appt.id, status)"
        />
      </div>
    </div>

    <!-- Public URL -->
    <div class="mt-8 p-4 md:p-5 rounded-2xl bg-[var(--color-primary)]/5 border border-[var(--color-primary)]/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div class="min-w-0">
        <p class="text-xs font-bold text-[var(--color-outline)] uppercase tracking-wider mb-1">Tu enlace de reservas</p>
        <p class="font-mono font-semibold text-[var(--color-primary)] truncate">agendly.mx/{{ slug }}</p>
      </div>
      <button
        class="text-sm font-semibold text-[var(--color-primary)] flex items-center gap-1.5 bg-white px-4 py-2 rounded-lg border border-[var(--color-primary)]/20 hover:bg-[var(--color-primary)]/5 transition-colors shrink-0"
        @click="copyPublicUrl(slug)"
      >
        <span class="material-symbols-outlined text-base" aria-hidden="true">{{ copied ? 'check' : 'content_copy' }}</span>
        {{ copied ? 'Copiado' : 'Copiar' }}
      </button>
    </div>
  </div>
</template>
