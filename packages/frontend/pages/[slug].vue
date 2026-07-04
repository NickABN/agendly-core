<script setup lang="ts">
import { formatDateKey, formatTime } from '@agendly/shared';

definePageMeta({ layout: 'public' });

const route = useRoute();
const slug = route.params.slug as string;

const b = await usePublicBooking(slug);

// Real 404 for crawlers and users when the slug does not exist
if (b.fetchError.value) {
  const status = (b.fetchError.value as { statusCode?: number }).statusCode;
  if (status === 404) {
    throw createError({ statusCode: 404, statusMessage: 'Negocio no encontrado', fatal: true });
  }
}

useSeoMeta({
  title: () => (b.tenantName.value ? `${b.tenantName.value} — Reserva en línea | Agendly` : 'Agendly'),
  description: () =>
    b.tenantName.value
      ? `Agenda tu cita en ${b.tenantName.value} en línea. Elige servicio, especialista y horario en menos de un minuto.`
      : 'Agenda tu cita en línea con Agendly.',
  ogTitle: () => b.tenantName.value,
  ogDescription: () => `Reserva tu cita en ${b.tenantName.value} con Agendly.`,
});

const progressStep = computed(() => Math.min(b.step.value, 4));
</script>

<template>
  <div class="min-h-screen bg-[var(--color-surface)]">
    <!-- Success: full-screen confirmation -->
    <BookingConfirmationScreen
      v-if="b.confirmation.value"
      :booking="b.confirmation.value"
      :service-name="b.selectedService.value?.name ?? ''"
      :employee-name="b.selectedEmployeeName.value"
      :tenant-name="b.tenantName.value"
    />

    <!-- Backend unavailable (non-404 error) -->
    <div v-else-if="b.fetchError.value" class="flex flex-col items-center justify-center min-h-screen px-6 text-center space-y-4">
      <span class="material-symbols-outlined text-5xl text-[var(--color-outline-variant)]" aria-hidden="true">cloud_off</span>
      <p class="font-semibold text-[var(--color-on-surface)]">No pudimos cargar la página</p>
      <p class="text-sm text-[var(--color-on-surface-variant)]">Intenta de nuevo en unos minutos.</p>
    </div>

    <!-- Booking flow -->
    <template v-else>
      <!-- Sticky header -->
      <header class="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-[var(--color-outline-variant)]/10">
        <div class="max-w-sm mx-auto flex items-center justify-between px-4 h-14">
          <button
            v-if="b.step.value > 1"
            class="flex items-center gap-1 text-[var(--color-primary)] text-sm font-medium"
            aria-label="Regresar al paso anterior"
            @click="b.step.value--"
          >
            <span class="material-symbols-outlined text-lg" aria-hidden="true">arrow_back</span>
          </button>
          <div v-else class="w-8"></div>

          <span class="font-bold text-[var(--color-on-surface)] tracking-tight">Agendly</span>

          <div class="w-8 h-8 rounded-full bg-[var(--color-surface-container-high)] flex items-center justify-center" aria-hidden="true">
            <span class="material-symbols-outlined text-sm text-[var(--color-on-surface-variant)]">person</span>
          </div>
        </div>

        <BookingProgressBar :current="progressStep" :total="4" />
      </header>

      <div class="max-w-sm mx-auto px-4 py-6 pb-24">
        <!-- Business header (step 1 only) -->
        <div v-if="b.step.value === 1" class="mb-6 space-y-1">
          <div class="flex items-center gap-2">
            <span class="material-symbols-outlined text-emerald-500 text-lg" style="font-variation-settings: 'FILL' 1" aria-hidden="true">verified</span>
            <h1 class="text-2xl font-bold text-[var(--color-on-surface)] leading-tight">{{ b.tenantName.value }}</h1>
          </div>
          <p class="text-sm text-[var(--color-on-surface-variant)]">Reserva tu experiencia de bienestar</p>
        </div>

        <!-- Step chips for step > 1 -->
        <div v-if="b.step.value > 1" class="flex flex-wrap gap-2 mb-5">
          <div class="inline-flex items-center gap-1.5 bg-blue-50 text-[var(--color-primary)] rounded-full px-3 py-1 text-xs font-semibold border border-[var(--color-primary)]/10">
            <span class="material-symbols-outlined text-sm" style="font-variation-settings: 'FILL' 1" aria-hidden="true">content_cut</span>
            {{ b.selectedService.value?.name }} · {{ b.selectedService.value?.durationMinutes }} min
          </div>
          <div v-if="b.step.value > 2 && b.selectedEmployeeName.value" class="inline-flex items-center gap-1.5 bg-blue-50 text-[var(--color-primary)] rounded-full px-3 py-1 text-xs font-semibold border border-[var(--color-primary)]/10">
            <span class="material-symbols-outlined text-sm" aria-hidden="true">person</span>
            {{ b.selectedEmployeeName.value }}
          </div>
          <div v-if="b.step.value === 4 && b.selectedSlot.value" class="inline-flex items-center gap-1.5 bg-blue-50 text-[var(--color-primary)] rounded-full px-3 py-1 text-xs font-semibold border border-[var(--color-primary)]/10">
            <span class="material-symbols-outlined text-sm" aria-hidden="true">schedule</span>
            {{ formatDateKey(b.selectedDate.value, 'short') }} · {{ formatTime(b.selectedSlot.value) }}
          </div>
        </div>

        <!-- Error banner (visible on any step, incl. 409 recovery on step 3) -->
        <div v-if="b.error.value && b.step.value >= 3" class="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2" role="alert">
          <span class="material-symbols-outlined text-lg" aria-hidden="true">error</span>
          {{ b.error.value }}
        </div>

        <!-- STEP 1: Service selection -->
        <div v-if="b.step.value === 1">
          <h2 class="text-lg font-bold text-[var(--color-on-surface)] mb-4">¿Qué servicio necesitas?</h2>
          <div class="space-y-3">
            <BookingServiceCard
              v-for="s in b.services.value"
              :key="s.id"
              :name="s.name"
              :duration-minutes="s.durationMinutes"
              :price="s.priceMXN"
              :selected="b.selectedServiceId.value === s.id"
              @select="b.selectService(s.id)"
            />
          </div>
        </div>

        <!-- STEP 2: Employee selection -->
        <div v-if="b.step.value === 2">
          <h2 class="text-lg font-bold text-[var(--color-on-surface)] mb-1">Selecciona tu especialista</h2>
          <p class="text-sm text-[var(--color-on-surface-variant)] mb-5">Elige con quién quieres tu cita</p>

          <BookingEmployeeSelector
            :employees="b.filteredEmployees.value"
            :model-value="b.selectedEmployeeId.value"
            @update:model-value="b.selectEmployee($event)"
          />
        </div>

        <!-- STEP 3: Date + time -->
        <div v-if="b.step.value === 3" class="space-y-6">
          <div>
            <h2 class="text-lg font-bold text-[var(--color-on-surface)] mb-1">Selecciona tu horario</h2>
            <p class="text-sm text-[var(--color-on-surface-variant)]">{{ b.selectedService.value?.name }} · {{ b.selectedService.value?.durationMinutes }} min</p>
          </div>

          <div>
            <p class="text-xs font-bold text-[var(--color-outline)] uppercase tracking-wider mb-3">¿Qué día?</p>
            <BookingDayTabs v-model="b.selectedDate.value" />
          </div>

          <div v-if="b.selectedDate.value || b.loadingSlots.value">
            <p class="text-xs font-bold text-[var(--color-outline)] uppercase tracking-wider mb-3">Horarios disponibles</p>
            <BookingSlotGrid
              :slots="b.slots.value"
              :model-value="b.selectedSlot.value"
              :loading="b.loadingSlots.value"
              :has-date="!!b.selectedDate.value"
              @update:model-value="b.selectedSlot.value = $event"
            />
          </div>

          <button
            v-if="b.selectedSlot.value"
            class="w-full soul-gradient text-white py-4 rounded-xl font-bold text-base flex items-center justify-center gap-2 shadow-lg shadow-[var(--color-primary)]/20 active:scale-[0.98] transition-all"
            @click="b.goToClientForm"
          >
            Continuar al paso final
            <span class="material-symbols-outlined" aria-hidden="true">arrow_forward</span>
          </button>

          <button
            class="w-full text-center text-sm text-[var(--color-on-surface-variant)] hover:text-[var(--color-primary)] transition-colors"
            @click="b.step.value = 1"
          >
            Regresar a servicios
          </button>
        </div>

        <!-- STEP 4: Client info -->
        <div v-if="b.step.value === 4">
          <!-- Summary card -->
          <div class="bg-white rounded-2xl p-5 mb-6 shadow-sm border border-[var(--color-outline-variant)]/10 space-y-3">
            <p class="text-xs font-bold text-[var(--color-outline)] uppercase tracking-wider">Resumen de la cita</p>
            <div class="grid grid-cols-2 gap-3">
              <div class="space-y-1">
                <div class="flex items-center gap-1.5">
                  <span class="material-symbols-outlined text-[var(--color-primary)] text-base" aria-hidden="true">content_cut</span>
                  <span class="text-xs font-bold text-[var(--color-outline)] uppercase tracking-wider">Servicio</span>
                </div>
                <p class="text-sm font-semibold text-[var(--color-on-surface)]">{{ b.selectedService.value?.name }}</p>
              </div>
              <div class="space-y-1">
                <div class="flex items-center gap-1.5">
                  <span class="material-symbols-outlined text-[var(--color-primary)] text-base" aria-hidden="true">person</span>
                  <span class="text-xs font-bold text-[var(--color-outline)] uppercase tracking-wider">Especialista</span>
                </div>
                <p class="text-sm font-semibold text-[var(--color-on-surface)]">{{ b.selectedEmployeeName.value }}</p>
              </div>
              <div class="space-y-1">
                <div class="flex items-center gap-1.5">
                  <span class="material-symbols-outlined text-[var(--color-primary)] text-base" aria-hidden="true">event</span>
                  <span class="text-xs font-bold text-[var(--color-outline)] uppercase tracking-wider">Fecha</span>
                </div>
                <p class="text-sm font-semibold text-[var(--color-on-surface)]">{{ formatDateKey(b.selectedDate.value, 'short') }}</p>
              </div>
              <div class="space-y-1">
                <div class="flex items-center gap-1.5">
                  <span class="material-symbols-outlined text-[var(--color-primary)] text-base" aria-hidden="true">payments</span>
                  <span class="text-xs font-bold text-[var(--color-outline)] uppercase tracking-wider">Precio est.</span>
                </div>
                <p class="text-sm font-semibold text-[var(--color-on-surface)]">${{ b.selectedService.value?.priceMXN }} MXN</p>
              </div>
            </div>
          </div>

          <h2 class="text-lg font-bold text-[var(--color-on-surface)] mb-5">Tus datos</h2>

          <form class="space-y-4" @submit.prevent="b.submitBooking">
            <div class="space-y-2">
              <label for="client-name" class="text-xs font-bold text-[var(--color-outline)] uppercase tracking-wider">Nombre completo</label>
              <input
                id="client-name"
                v-model="b.clientForm.name"
                required
                minlength="2"
                type="text"
                placeholder="Ej. Alex García"
                autocomplete="name"
                class="w-full bg-[var(--color-surface-container-high)] border-none rounded-xl px-5 py-4 focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:bg-[var(--color-surface-container-lowest)] outline-none transition-all placeholder:text-[var(--color-outline)]/50"
              />
            </div>

            <div class="space-y-2">
              <label for="client-phone" class="text-xs font-bold text-[var(--color-outline)] uppercase tracking-wider">Teléfono móvil</label>
              <input
                id="client-phone"
                v-model="b.clientForm.phone"
                required
                type="tel"
                inputmode="tel"
                pattern="\+?[\d\s()-]{8,20}"
                title="Ingresa un teléfono válido de 8 a 20 dígitos"
                placeholder="+52 000 000 0000"
                autocomplete="tel"
                class="w-full bg-[var(--color-surface-container-high)] border-none rounded-xl px-5 py-4 focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:bg-[var(--color-surface-container-lowest)] outline-none transition-all placeholder:text-[var(--color-outline)]/50"
              />
            </div>

            <div class="space-y-2">
              <label for="client-email" class="text-xs font-bold text-[var(--color-outline)] uppercase tracking-wider">Email <span class="normal-case font-normal text-[var(--color-outline)]">(opcional)</span></label>
              <input
                id="client-email"
                v-model="b.clientForm.email"
                type="email"
                placeholder="Para recibir confirmación"
                autocomplete="email"
                class="w-full bg-[var(--color-surface-container-high)] border-none rounded-xl px-5 py-4 focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:bg-[var(--color-surface-container-lowest)] outline-none transition-all placeholder:text-[var(--color-outline)]/50"
              />
            </div>

            <label class="flex items-start gap-3 cursor-pointer">
              <input
                v-model="b.clientForm.privacyAccepted"
                type="checkbox"
                class="mt-0.5 w-4 h-4 rounded border-[var(--color-outline-variant)] accent-[var(--color-primary)]"
              />
              <span class="text-sm text-[var(--color-on-surface-variant)] leading-snug">
                Al confirmar, aceptas nuestras
                <NuxtLink to="/privacidad" target="_blank" class="text-[var(--color-primary)] underline">Políticas de Cancelación, Términos de Servicio y Aviso de Privacidad</NuxtLink>.
              </span>
            </label>

            <button
              type="submit"
              :disabled="b.submitting.value"
              class="w-full soul-gradient text-white py-4 rounded-full font-bold text-base flex items-center justify-center gap-2 shadow-lg shadow-[var(--color-primary)]/20 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 1" aria-hidden="true">check_circle</span>
              {{ b.submitting.value ? 'Confirmando...' : 'Confirmar cita' }}
            </button>
          </form>
        </div>
      </div>

      <!-- Bottom Agendly badge -->
      <div class="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-md border-t border-[var(--color-outline-variant)]/10 py-3">
        <p class="text-center text-xs text-[var(--color-outline)]">
          Hecho con <span class="font-bold text-[var(--color-on-surface)]">⬡ Agendly</span>
        </p>
      </div>
    </template>
  </div>
</template>
