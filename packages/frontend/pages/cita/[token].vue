<script setup lang="ts">
import { formatDate, formatTime } from '@agendly/shared';
import type { ClientAppointmentDto } from '@agendly/shared';

definePageMeta({ layout: false });

// The token in the URL grants access to the appointment: keep it out of search
// engines and out of the Referer sent to other sites.
useHead({
  title: 'Tu cita — Agendly',
  meta: [
    { name: 'robots', content: 'noindex, nofollow' },
    { name: 'referrer', content: 'no-referrer' },
  ],
});

const route = useRoute();
const config = useRuntimeConfig();
const apiUrl = config.public.apiUrl; // browser-facing, for the cancel POST
const ssrBase = apiBase();
const token = String(route.params.token ?? '');

const { data: appointment, error: fetchError } = await useAsyncData(`cita-${token}`, () =>
  $fetch<ClientAppointmentDto>(`${ssrBase}/public/appointments/${encodeURIComponent(token)}`),
);

const confirming = ref(false);
const reason = ref('');
const cancelling = ref(false);
const cancelError = ref('');
const justCancelled = ref(false);

const timezone = computed(() => appointment.value?.business.timezone);
const dateLabel = computed(() =>
  appointment.value ? formatDate(appointment.value.startTime, 'long', timezone.value) : '',
);
const timeLabel = computed(() =>
  appointment.value
    ? `${formatTime(appointment.value.startTime, timezone.value)} — ${formatTime(appointment.value.endTime, timezone.value)}`
    : '',
);

const statusLabel: Record<string, string> = {
  CONFIRMED: 'Confirmada',
  CANCELLED: 'Cancelada',
  COMPLETED: 'Completada',
  NO_SHOW: 'No asististe',
};

async function cancel() {
  cancelling.value = true;
  cancelError.value = '';
  try {
    appointment.value = await $fetch<ClientAppointmentDto>(
      `${apiUrl}/public/appointments/${encodeURIComponent(token)}/cancel`,
      { method: 'POST', body: { reason: reason.value.trim() || undefined } },
    );
    justCancelled.value = true;
    confirming.value = false;
  } catch (e: unknown) {
    const err = e as { data?: { message?: string | string[] } };
    const message = err.data?.message;
    cancelError.value =
      (Array.isArray(message) ? message[0] : message) ||
      'No pudimos cancelar tu cita. Intenta de nuevo o llama al negocio.';
  } finally {
    cancelling.value = false;
  }
}
</script>

<template>
  <div class="bg-surface text-on-surface min-h-screen flex items-center justify-center p-4 md:p-6">
    <main class="w-full max-w-md">
      <div
        class="bg-surface-container-lowest rounded-2xl p-6 md:p-10 editorial-shadow border border-outline-variant/10"
      >
        <!-- Not found / invalid link -->
        <div v-if="fetchError || !appointment" class="text-center space-y-6">
          <div class="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto">
            <span class="material-symbols-outlined text-red-600 text-4xl" aria-hidden="true"
              >link_off</span
            >
          </div>
          <div>
            <h1 class="text-2xl font-bold text-on-surface mb-2 tracking-tight">Enlace no válido</h1>
            <p class="text-on-surface-variant text-sm leading-relaxed">
              No encontramos esta cita. Revisa que el enlace de tu correo esté completo o comunícate
              con el negocio.
            </p>
          </div>
        </div>

        <template v-else>
          <div class="mb-6">
            <p class="text-xs font-bold text-outline uppercase tracking-wider mb-1">
              {{ appointment.business.name }}
            </p>
            <h1 class="text-2xl font-bold text-on-surface tracking-tight">
              {{ justCancelled ? 'Tu cita fue cancelada' : `Hola, ${appointment.clientName}` }}
            </h1>
            <p v-if="justCancelled" class="text-sm text-on-surface-variant mt-2">
              Avisamos al negocio y el horario quedó libre. ¡Gracias por avisar!
            </p>
          </div>

          <div class="p-4 rounded-xl bg-surface-container-low space-y-2 mb-6">
            <div class="flex items-center justify-between gap-2">
              <span class="text-sm font-semibold text-on-surface">{{
                appointment.serviceName
              }}</span>
              <span
                class="text-[11px] px-2 py-0.5 rounded-full font-bold"
                :class="
                  appointment.status === 'CONFIRMED'
                    ? 'bg-blue-50 text-primary border border-blue-100'
                    : appointment.status === 'CANCELLED'
                      ? 'bg-red-50 text-red-700 border border-red-100'
                      : 'bg-surface-container-high text-on-surface-variant'
                "
                >{{ statusLabel[appointment.status] ?? appointment.status }}</span
              >
            </div>
            <p class="text-sm text-on-surface-variant flex items-center gap-2">
              <span class="material-symbols-outlined text-base" aria-hidden="true">person</span>
              {{ appointment.employeeName }}
            </p>
            <p class="text-sm text-on-surface-variant flex items-center gap-2">
              <span class="material-symbols-outlined text-base" aria-hidden="true">event</span>
              <span class="inline-block first-letter:uppercase">{{ dateLabel }}</span>
            </p>
            <p class="text-sm text-on-surface-variant flex items-center gap-2">
              <span class="material-symbols-outlined text-base" aria-hidden="true">schedule</span>
              {{ timeLabel }}
            </p>
            <p
              v-if="appointment.business.address"
              class="text-sm text-on-surface-variant flex items-center gap-2"
            >
              <span class="material-symbols-outlined text-base" aria-hidden="true"
                >location_on</span
              >
              {{ appointment.business.address }}
            </p>
          </div>

          <!-- Cancel flow -->
          <div v-if="appointment.canCancel" class="space-y-4">
            <button
              v-if="!confirming"
              class="w-full py-3 rounded-xl text-sm font-semibold bg-red-50 text-red-700 border border-red-100 hover:bg-red-100 transition-colors"
              @click="confirming = true"
            >
              Cancelar mi cita
            </button>
            <template v-else>
              <div>
                <label
                  for="cancel-reason"
                  class="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5"
                  >Motivo <span class="normal-case font-normal">(opcional)</span></label
                >
                <textarea
                  id="cancel-reason"
                  v-model="reason"
                  rows="2"
                  maxlength="200"
                  placeholder="Ej: me surgió un imprevisto"
                  class="w-full px-4 py-2.5 bg-surface-container-low border-none rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:bg-white transition-all outline-none resize-none"
                ></textarea>
              </div>
              <p
                v-if="cancelError"
                class="text-sm text-red-700 p-3 rounded-xl bg-red-50 border border-red-100"
                role="alert"
              >
                {{ cancelError }}
              </p>
              <div class="flex gap-3">
                <button
                  class="flex-1 py-3 rounded-xl text-sm font-semibold text-on-surface-variant hover:bg-surface-container-high transition-colors"
                  :disabled="cancelling"
                  @click="confirming = false"
                >
                  Conservar cita
                </button>
                <button
                  class="flex-1 py-3 rounded-xl text-sm font-semibold bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50"
                  :disabled="cancelling"
                  @click="cancel"
                >
                  {{ cancelling ? 'Cancelando...' : 'Sí, cancelar' }}
                </button>
              </div>
            </template>
          </div>

          <p
            v-else-if="!justCancelled && appointment.status === 'CONFIRMED'"
            class="text-sm text-on-surface-variant"
          >
            Esta cita ya comenzó y no se puede cancelar en línea.
          </p>

          <div class="mt-6 pt-6 border-t border-outline-variant/10 space-y-2 text-sm">
            <a
              v-if="appointment.business.phone"
              :href="`tel:${appointment.business.phone}`"
              class="flex items-center gap-2 text-primary font-medium hover:underline"
            >
              <span class="material-symbols-outlined text-base" aria-hidden="true">call</span>
              Llamar a {{ appointment.business.name }}
            </a>
            <NuxtLink
              :to="`/${appointment.business.slug}`"
              class="flex items-center gap-2 text-primary font-medium hover:underline"
            >
              <span class="material-symbols-outlined text-base" aria-hidden="true"
                >calendar_add_on</span
              >
              {{ appointment.status === 'CONFIRMED' ? 'Reservar otra cita' : 'Reservar de nuevo' }}
            </NuxtLink>
          </div>
        </template>
      </div>
      <p class="text-center text-xs text-on-surface-variant mt-6">Agenda gestionada por Agendly</p>
    </main>
  </div>
</template>
