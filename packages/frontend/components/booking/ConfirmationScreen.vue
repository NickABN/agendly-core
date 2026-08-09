<script setup lang="ts">
import { BUSINESS_TZ, formatDate, formatTime } from '@agendly/shared';
import type { BookingResponse } from '@agendly/shared';

const props = withDefaults(
  defineProps<{
    booking: BookingResponse;
    serviceName: string;
    employeeName: string;
    tenantName: string;
    /** IANA timezone of the business — the confirmation shows its wall clock. */
    timezone?: string;
  }>(),
  { timezone: BUSINESS_TZ },
);

/** Short human reference derived from the REAL appointment id. */
const reference = computed(() => `AG-${props.booking.id.slice(-6).toUpperCase()}`);

function toIcsStamp(iso: string): string {
  return iso.replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/** Generates and downloads a real .ics calendar event — no backend needed. */
function addToCalendar() {
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Agendly//Booking//ES',
    'BEGIN:VEVENT',
    `UID:${props.booking.id}@agendly.mx`,
    `DTSTAMP:${toIcsStamp(new Date().toISOString())}`,
    `DTSTART:${toIcsStamp(props.booking.startTime)}`,
    `DTEND:${toIcsStamp(props.booking.endTime)}`,
    `SUMMARY:${props.serviceName} — ${props.tenantName}`,
    `DESCRIPTION:Cita con ${props.employeeName} en ${props.tenantName}. Referencia ${reference.value}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `cita-${reference.value}.ics`;
  link.click();
  URL.revokeObjectURL(url);
}
</script>

<template>
  <div
    class="min-h-screen flex flex-col"
    style="background: linear-gradient(160deg, #005da9 0%, #0076d3 100%)"
  >
    <!-- Header -->
    <div class="flex items-center justify-between p-6">
      <span class="text-white font-bold text-lg tracking-tight">Agendly</span>
    </div>

    <!-- Success icon -->
    <div class="flex flex-col items-center px-6 py-8 text-center">
      <div
        class="w-24 h-24 rounded-full bg-white/20 flex items-center justify-center mb-6 animate-scale-in"
      >
        <div class="w-16 h-16 rounded-full bg-white flex items-center justify-center">
          <span
            class="material-symbols-outlined text-[var(--color-primary)] text-4xl"
            style="font-variation-settings: 'FILL' 1"
            aria-hidden="true"
            >check_circle</span
          >
        </div>
      </div>
      <h1 class="text-2xl font-black text-white mb-2">¡Tu cita está confirmada!</h1>
      <p class="text-white/70 text-sm">Hemos reservado tu espacio con éxito.</p>
    </div>

    <!-- Ticket card -->
    <div class="mx-4 bg-white rounded-2xl shadow-2xl overflow-hidden flex-1">
      <!-- Ticket header -->
      <div class="p-6 pb-4">
        <div class="flex items-center gap-3 mb-6">
          <div
            class="w-10 h-10 rounded-full bg-[var(--color-primary)]/10 flex items-center justify-center"
          >
            <span
              class="material-symbols-outlined text-[var(--color-primary)] text-xl"
              aria-hidden="true"
              >content_cut</span
            >
          </div>
          <div>
            <p class="font-bold text-[var(--color-on-surface)] text-lg leading-tight">
              {{ serviceName }}
            </p>
            <p class="text-sm text-[var(--color-on-surface-variant)]">{{ tenantName }}</p>
          </div>
        </div>

        <!-- 2-column details -->
        <div class="grid grid-cols-2 gap-4">
          <div>
            <p class="text-xs font-bold text-[var(--color-outline)] uppercase tracking-wider mb-1">
              Especialista
            </p>
            <div class="flex items-center gap-2">
              <div
                class="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
                :class="colorForName(employeeName)"
              >
                {{ getInitials(employeeName) }}
              </div>
              <p class="font-semibold text-sm text-[var(--color-on-surface)]">{{ employeeName }}</p>
            </div>
          </div>
          <div>
            <p class="text-xs font-bold text-[var(--color-outline)] uppercase tracking-wider mb-1">
              Fecha
            </p>
            <p class="font-semibold text-sm text-[var(--color-on-surface)] capitalize">
              {{ formatDate(booking.startTime, 'long', timezone) }}
            </p>
          </div>
          <div>
            <p class="text-xs font-bold text-[var(--color-outline)] uppercase tracking-wider mb-1">
              Hora
            </p>
            <p class="font-semibold text-sm text-[var(--color-on-surface)]">
              {{ formatTime(booking.startTime, timezone) }}
            </p>
          </div>
          <div>
            <p class="text-xs font-bold text-[var(--color-outline)] uppercase tracking-wider mb-1">
              Lugar
            </p>
            <p class="font-semibold text-sm text-[var(--color-on-surface)]">{{ tenantName }}</p>
          </div>
        </div>
      </div>

      <!-- Ticket perforation effect -->
      <div class="relative flex items-center my-2" aria-hidden="true">
        <div class="w-5 h-5 rounded-full bg-[var(--color-primary)] -ml-2.5"></div>
        <div
          class="flex-1 border-t-2 border-dashed border-[var(--color-outline-variant)]/40 mx-2"
        ></div>
        <div class="w-5 h-5 rounded-full bg-[var(--color-primary)] -mr-2.5"></div>
      </div>

      <!-- Ticket footer -->
      <div class="p-6 pt-4 space-y-4">
        <button
          class="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[var(--color-surface-container-low)] hover:bg-[var(--color-surface-container-high)] transition-colors font-semibold text-sm text-[var(--color-on-surface)]"
          @click="addToCalendar"
        >
          <span class="material-symbols-outlined text-lg" aria-hidden="true">calendar_add_on</span>
          Agregar al calendario
        </button>

        <div class="flex items-center gap-1 text-xs text-[var(--color-on-surface-variant)]">
          <span
            class="material-symbols-outlined text-sm text-emerald-600"
            style="font-variation-settings: 'FILL' 1"
            aria-hidden="true"
            >verified</span
          >
          <span>Referencia: {{ reference }}</span>
        </div>
      </div>
    </div>

    <!-- Bottom message -->
    <div class="p-6 text-center">
      <p class="text-white/60 text-xs">Listo. No necesitaste crear cuenta para esto</p>
      <div class="flex items-center justify-center gap-1 mt-2">
        <span class="text-white/40 text-xs">Hecho con</span>
        <span class="text-white font-bold text-xs">⬡ Agendly</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
@keyframes scale-in {
  0% {
    transform: scale(0);
    opacity: 0;
  }
  60% {
    transform: scale(1.1);
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}
.animate-scale-in {
  animation: scale-in 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
}
</style>
