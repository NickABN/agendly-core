<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { formatDateKey, formatPhone, formatTime } from '@agendly/shared';
import PhoneInput from '~/components/ui/PhoneInput.vue';

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
  title: () =>
    b.tenantName.value ? `${b.tenantName.value} — Reserva en línea | Agendly` : 'Agendly',
  description: () =>
    b.tenantName.value
      ? `Agenda tu cita en ${b.tenantName.value} en línea. Elige servicio, especialista y horario en menos de un minuto.`
      : 'Agenda tu cita en línea con Agendly.',
  ogTitle: () => b.tenantName.value,
  ogDescription: () => `Reserva tu cita en ${b.tenantName.value} con Agendly.`,
});

// SSR found the backend asleep: retry from the browser right away (with backoff).
onMounted(() => {
  if (b.serverWaking.value) void b.retryTenant();
});

const progressStep = computed(() => Math.min(b.step.value, 4));

const tenantInitials = computed(() => getInitials(b.tenantName.value || 'A'));
const clientNameInput = ref<HTMLInputElement | null>(null);
const mapsUrl = computed(() =>
  b.tenantAddress.value
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(b.tenantAddress.value)}`
    : '',
);

async function continueToClientForm() {
  b.goToClientForm();
  await nextTick();

  const firstField = clientNameInput.value;
  if (!firstField) return;

  firstField.focus({ preventScroll: true });
  const prefersReducedMotion =
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  firstField.scrollIntoView?.({
    behavior: prefersReducedMotion ? 'auto' : 'smooth',
    block: 'center',
  });
}

// --- Booking friction: avoid two "continue" buttons on the date/time step ---
// When the in-page "Continuar al paso final" button is within the viewport,
// the sticky summary bar at the bottom is redundant, so we hide it. When that
// button scrolls out of view, we bring the sticky bar back (only while a day
// and time are selected). We track the in-page button via IntersectionObserver.
const inPageContinueButton = ref<HTMLButtonElement | null>(null);
// Default to "in view" so that, before the observer reports, the sticky bar
// stays hidden while the in-page button is on screen.
const inPageButtonInView = ref(true);
let continueObserver: IntersectionObserver | null = null;

// Show the sticky bar only on step 3, with both day and time selected, and only
// when the in-page continue button is NOT visible. When IntersectionObserver is
// unavailable we keep the previous behavior (bar always shown while selected).
const showStickyContinueBar = computed(
  () =>
    b.step?.value === 3 &&
    !!b.selectedDate?.value &&
    !!b.selectedSlot?.value &&
    !inPageButtonInView.value,
);

function disconnectContinueObserver() {
  if (continueObserver) {
    continueObserver.disconnect();
    continueObserver = null;
  }
}

function observeContinueButton(target: HTMLButtonElement | null) {
  disconnectContinueObserver();

  // Guard environments without IntersectionObserver (SSR / old browsers):
  // fall back to the previous behavior by treating the button as out of view
  // so the sticky bar stays available while a day and time are selected.
  if (typeof IntersectionObserver === 'undefined') {
    inPageButtonInView.value = false;
    return;
  }

  if (!target) return;

  inPageButtonInView.value = true;
  continueObserver = new IntersectionObserver((entries) => {
    const entry = entries[entries.length - 1];
    if (entry) inPageButtonInView.value = entry.isIntersecting;
  });
  continueObserver.observe(target);
}

watch(inPageContinueButton, (target) => {
  observeContinueButton(target);
});

// Reset / disconnect when leaving the date-and-time step.
watch(
  () => b.step?.value,
  (step) => {
    if (step !== 3) {
      disconnectContinueObserver();
      inPageButtonInView.value = true;
    }
  },
);

onBeforeUnmount(disconnectContinueObserver);
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
      :timezone="b.tenantTimezone.value"
      :tenant-info="b.tenantData.value?.tenant ?? null"
    />

    <!-- Backend unavailable (non-404 error) -->
    <div
      v-else-if="b.fetchError.value"
      class="flex flex-col items-center justify-center min-h-screen px-6 text-center space-y-4"
    >
      <span
        class="material-symbols-outlined text-5xl text-[var(--color-outline-variant)]"
        aria-hidden="true"
        >cloud_off</span
      >
      <template v-if="b.serverWaking.value">
        <p class="font-semibold text-[var(--color-on-surface)]">Estamos despertando el servidor</p>
        <p class="text-sm text-[var(--color-on-surface-variant)] max-w-sm">
          Agendly usa por ahora un plan gratuito de hosting (Render) que pone el servidor en pausa
          cuando no hay actividad. Al recibir la primera solicitud se reactiva y puede tardar hasta
          un minuto. Es un tema de infraestructura, no una falla de la app.
        </p>
        <button
          type="button"
          class="bg-[var(--color-primary)] text-white px-6 py-3 rounded-lg font-semibold hover:opacity-90 transition-all disabled:opacity-50"
          :disabled="b.retryingTenant.value"
          @click="b.retryTenant()"
        >
          {{ b.retryingTenant.value ? 'Reintentando…' : 'Reintentar' }}
        </button>
      </template>
      <template v-else>
        <p class="font-semibold text-[var(--color-on-surface)]">No pudimos cargar la página</p>
        <p class="text-sm text-[var(--color-on-surface-variant)]">
          Intenta de nuevo en unos minutos.
        </p>
      </template>
    </div>

    <!-- Booking flow -->
    <template v-else>
      <!-- Sticky header -->
      <header
        class="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-[var(--color-outline-variant)]/10"
      >
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

          <div class="flex items-center gap-2 min-w-0">
            <img
              v-if="b.tenantLogoUrl.value"
              :src="b.tenantLogoUrl.value"
              alt=""
              class="w-7 h-7 rounded-full object-cover shrink-0"
            />
            <span
              v-else
              class="w-7 h-7 rounded-full bg-[var(--color-primary)] text-white text-[11px] font-bold flex items-center justify-center shrink-0"
              aria-hidden="true"
              >{{ tenantInitials }}</span
            >
            <span class="font-bold text-[var(--color-on-surface)] tracking-tight truncate">{{
              b.tenantName.value
            }}</span>
          </div>

          <div class="w-8"></div>
        </div>

        <BookingProgressBar :current="progressStep" :total="4" />
      </header>

      <div class="max-w-sm mx-auto px-4 py-6 pb-24">
        <!-- Business header (step 1 only) -->
        <div v-if="b.step.value === 1" class="mb-6 space-y-1">
          <div
            class="relative mb-10 aspect-[3/1] rounded-2xl bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-container)]"
          >
            <img
              v-if="b.tenantBannerUrl.value"
              :src="b.tenantBannerUrl.value"
              alt=""
              class="absolute inset-0 size-full rounded-2xl object-cover"
            />
            <img
              v-if="b.tenantLogoUrl.value"
              :src="b.tenantLogoUrl.value"
              alt=""
              class="absolute bottom-0 left-4 size-[72px] translate-y-1/2 rounded-full border-4 border-white object-cover"
            />
            <span
              v-else
              class="absolute bottom-0 left-4 flex size-[72px] translate-y-1/2 items-center justify-center rounded-full border-4 border-white bg-[var(--color-surface-container-lowest)] text-lg font-bold text-[var(--color-primary)]"
              aria-hidden="true"
            >
              {{ tenantInitials }}
            </span>
          </div>
          <div class="space-y-1">
            <div class="flex items-center gap-2">
              <span
                class="material-symbols-outlined text-lg text-emerald-500"
                style="font-variation-settings: 'FILL' 1"
                aria-hidden="true"
                >verified</span
              >
              <h1 class="text-2xl font-bold leading-tight text-[var(--color-on-surface)]">
                {{ b.tenantName.value }}
              </h1>
            </div>
            <p class="text-sm text-[var(--color-on-surface-variant)]">
              Reserva tu experiencia de bienestar
            </p>
            <div
              v-if="b.tenantAddress.value || b.tenantPhone.value"
              class="flex flex-col gap-1 pt-2 text-xs text-[var(--color-on-surface-variant)]"
            >
              <a
                v-if="b.tenantAddress.value"
                :href="mapsUrl"
                target="_blank"
                rel="noopener"
                class="flex items-start gap-1.5 hover:text-[var(--color-primary)]"
              >
                <span class="material-symbols-outlined text-sm" aria-hidden="true"
                  >location_on</span
                >
                {{ b.tenantAddress.value }}
              </a>
              <a
                v-if="b.tenantPhone.value"
                :href="`tel:${b.tenantPhone.value}`"
                class="flex items-center gap-1.5 hover:text-[var(--color-primary)]"
              >
                <span class="material-symbols-outlined text-sm" aria-hidden="true">call</span>
                {{ formatPhone(b.tenantPhone.value) }}
              </a>
            </div>
          </div>
        </div>

        <!-- Step chips for step > 1 -->
        <div v-if="b.step.value > 1" class="flex flex-wrap gap-2 mb-5">
          <div
            class="inline-flex items-center gap-1.5 bg-blue-50 text-[var(--color-primary)] rounded-full px-3 py-1 text-xs font-semibold border border-[var(--color-primary)]/10"
          >
            <span
              class="material-symbols-outlined text-sm"
              style="font-variation-settings: 'FILL' 1"
              aria-hidden="true"
              >content_cut</span
            >
            {{ b.selectedService.value?.name }} · {{ b.selectedService.value?.durationMinutes }} min
          </div>
          <div
            v-if="b.step.value > 2 && b.selectedEmployeeName.value"
            class="inline-flex items-center gap-1.5 bg-blue-50 text-[var(--color-primary)] rounded-full px-3 py-1 text-xs font-semibold border border-[var(--color-primary)]/10"
          >
            <span class="material-symbols-outlined text-sm" aria-hidden="true">person</span>
            {{ b.selectedEmployeeName.value }}
          </div>
          <div
            v-if="b.step.value === 4 && b.selectedSlot.value"
            class="inline-flex items-center gap-1.5 bg-blue-50 text-[var(--color-primary)] rounded-full px-3 py-1 text-xs font-semibold border border-[var(--color-primary)]/10"
          >
            <span class="material-symbols-outlined text-sm" aria-hidden="true">schedule</span>
            {{ formatDateKey(b.selectedDate.value, 'short') }} ·
            {{ formatTime(b.selectedSlot.value, b.tenantTimezone.value) }}
          </div>
        </div>

        <!-- Error banner (visible on any step, incl. 409 recovery on step 3) -->
        <div
          v-if="b.error.value && b.step.value >= 3"
          class="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2"
          role="alert"
        >
          <span class="material-symbols-outlined text-lg" aria-hidden="true">error</span>
          {{ b.error.value }}
        </div>

        <!-- STEP 1: Service selection -->
        <div v-if="b.step.value === 1">
          <h2 class="text-lg font-bold text-[var(--color-on-surface)] mb-4">
            ¿Qué servicio necesitas?
          </h2>
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
          <h2 class="text-lg font-bold text-[var(--color-on-surface)] mb-1">
            Selecciona tu especialista
          </h2>
          <p class="text-sm text-[var(--color-on-surface-variant)] mb-5">
            Elige con quién quieres tu cita
          </p>

          <BookingEmployeeSelector
            :employees="b.filteredEmployees.value"
            :model-value="b.selectedEmployeeId.value"
            @update:model-value="b.selectEmployee($event)"
          />
        </div>

        <!-- STEP 3: Date + time -->
        <div v-if="b.step.value === 3" class="space-y-6">
          <div>
            <h2 class="text-lg font-bold text-[var(--color-on-surface)] mb-1">
              Selecciona tu horario
            </h2>
            <p class="text-sm text-[var(--color-on-surface-variant)]">
              {{ b.selectedService.value?.name }} ·
              {{ b.selectedService.value?.durationMinutes }} min
            </p>
          </div>

          <div>
            <p class="text-xs font-bold text-[var(--color-outline)] uppercase tracking-wider mb-3">
              ¿Qué día?
            </p>
            <BookingDayTabs v-model="b.selectedDate.value" :timezone="b.tenantTimezone.value" />
          </div>

          <div v-if="b.selectedDate.value || b.loadingSlots.value">
            <p class="text-xs font-bold text-[var(--color-outline)] uppercase tracking-wider mb-3">
              Horarios disponibles
            </p>
            <BookingSlotGrid
              :slots="b.slots.value"
              :model-value="b.selectedSlot.value"
              :loading="b.loadingSlots.value"
              :has-date="!!b.selectedDate.value"
              :timezone="b.tenantTimezone.value"
              @update:model-value="b.selectedSlot.value = $event"
            />
          </div>

          <button
            v-if="b.selectedSlot.value"
            ref="inPageContinueButton"
            class="w-full soul-gradient text-white py-4 rounded-xl font-bold text-base flex items-center justify-center gap-2 shadow-lg shadow-[var(--color-primary)]/20 active:scale-[0.98] transition-all"
            @click="continueToClientForm"
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
          <div
            class="bg-white rounded-2xl p-5 mb-6 shadow-sm border border-[var(--color-outline-variant)]/10 space-y-3"
          >
            <p class="text-xs font-bold text-[var(--color-outline)] uppercase tracking-wider">
              Resumen de la cita
            </p>
            <div class="grid grid-cols-2 gap-3">
              <div class="space-y-1">
                <div class="flex items-center gap-1.5">
                  <span
                    class="material-symbols-outlined text-[var(--color-primary)] text-base"
                    aria-hidden="true"
                    >content_cut</span
                  >
                  <span
                    class="text-xs font-bold text-[var(--color-outline)] uppercase tracking-wider"
                    >Servicio</span
                  >
                </div>
                <p class="text-sm font-semibold text-[var(--color-on-surface)]">
                  {{ b.selectedService.value?.name }}
                </p>
              </div>
              <div class="space-y-1">
                <div class="flex items-center gap-1.5">
                  <span
                    class="material-symbols-outlined text-[var(--color-primary)] text-base"
                    aria-hidden="true"
                    >person</span
                  >
                  <span
                    class="text-xs font-bold text-[var(--color-outline)] uppercase tracking-wider"
                    >Especialista</span
                  >
                </div>
                <p class="text-sm font-semibold text-[var(--color-on-surface)]">
                  {{ b.selectedEmployeeName.value }}
                </p>
              </div>
              <div class="space-y-1">
                <div class="flex items-center gap-1.5">
                  <span
                    class="material-symbols-outlined text-[var(--color-primary)] text-base"
                    aria-hidden="true"
                    >event</span
                  >
                  <span
                    class="text-xs font-bold text-[var(--color-outline)] uppercase tracking-wider"
                    >Fecha</span
                  >
                </div>
                <p class="text-sm font-semibold text-[var(--color-on-surface)]">
                  {{ formatDateKey(b.selectedDate.value, 'short') }}
                </p>
              </div>
              <div class="space-y-1">
                <div class="flex items-center gap-1.5">
                  <span
                    class="material-symbols-outlined text-[var(--color-primary)] text-base"
                    aria-hidden="true"
                    >payments</span
                  >
                  <span
                    class="text-xs font-bold text-[var(--color-outline)] uppercase tracking-wider"
                    >Precio est.</span
                  >
                </div>
                <p class="text-sm font-semibold text-[var(--color-on-surface)]">
                  ${{ b.selectedService.value?.priceMXN }} MXN
                </p>
              </div>
            </div>
          </div>

          <h2 class="text-lg font-bold text-[var(--color-on-surface)] mb-5">Tus datos</h2>

          <form class="space-y-4" @submit.prevent="b.submitBooking">
            <div class="space-y-2">
              <label
                for="client-name"
                class="text-xs font-bold text-[var(--color-outline)] uppercase tracking-wider"
                >Nombre completo</label
              >
              <input
                id="client-name"
                ref="clientNameInput"
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
              <label
                for="client-phone"
                class="text-xs font-bold text-[var(--color-outline)] uppercase tracking-wider"
                >Teléfono móvil</label
              >
              <PhoneInput id="client-phone" v-model="b.clientForm.phone" :required="true" />
            </div>

            <div class="space-y-2">
              <label
                for="client-email"
                class="text-xs font-bold text-[var(--color-outline)] uppercase tracking-wider"
                >Email
                <span class="normal-case font-normal text-[var(--color-outline)]"
                  >(opcional)</span
                ></label
              >
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
                Acepto el
                <NuxtLink
                  to="/privacidad"
                  target="_blank"
                  class="text-[var(--color-primary)] underline"
                  >Aviso de Privacidad</NuxtLink
                >
                y los
                <NuxtLink
                  to="/terminos"
                  target="_blank"
                  class="text-[var(--color-primary)] underline"
                  >Términos</NuxtLink
                >. Cambios y cancelaciones se acuerdan directamente con el negocio.
              </span>
            </label>

            <button
              type="submit"
              :disabled="b.submitting.value"
              class="w-full soul-gradient text-white py-4 rounded-full font-bold text-base flex items-center justify-center gap-2 shadow-lg shadow-[var(--color-primary)]/20 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span
                class="material-symbols-outlined"
                style="font-variation-settings: 'FILL' 1"
                aria-hidden="true"
                >check_circle</span
              >
              {{ b.submitting.value ? 'Confirmando...' : 'Confirmar cita' }}
            </button>
          </form>
        </div>
      </div>

      <!-- Bottom Agendly badge -->
      <div
        v-if="!showStickyContinueBar"
        class="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-md border-t border-[var(--color-outline-variant)]/10 py-3"
      >
        <p class="text-center text-xs text-[var(--color-outline)]">
          Hecho con <span class="font-bold text-[var(--color-on-surface)]">⬡ Agendly</span>
        </p>
      </div>

      <!-- Quick continuation once both the day and time are selected.
           Hidden while the in-page "Continuar al paso final" button is on
           screen, so the user never sees two identical continue buttons. -->
      <Transition name="sticky-continue">
        <div
          v-if="showStickyContinueBar"
          class="fixed bottom-0 left-0 right-0 z-50 border-t border-[var(--color-outline-variant)]/20 bg-white/95 backdrop-blur-md"
          style="padding-bottom: calc(env(safe-area-inset-bottom) + 1rem)"
        >
          <div class="max-w-sm mx-auto px-4 pt-3">
            <div class="flex items-center justify-between gap-4">
              <p class="min-w-0 truncate text-sm font-semibold text-[var(--color-on-surface)]">
                {{ formatDateKey(b.selectedDate.value, 'short') }} ·
                {{ formatTime(b.selectedSlot.value, b.tenantTimezone.value) }}
              </p>
              <button
                type="button"
                class="shrink-0 soul-gradient text-white px-6 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-[var(--color-primary)]/20 active:scale-[0.98] transition-all"
                @click="continueToClientForm"
              >
                Continuar
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </template>
  </div>
</template>

<style scoped>
/* Smooth fade/slide for the sticky continuation bar. */
.sticky-continue-enter-active,
.sticky-continue-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}

.sticky-continue-enter-from,
.sticky-continue-leave-to {
  opacity: 0;
  transform: translateY(100%);
}

/* Respect users who prefer reduced motion: show/hide instantly. */
@media (prefers-reduced-motion: reduce) {
  .sticky-continue-enter-active,
  .sticky-continue-leave-active {
    transition: none;
  }

  .sticky-continue-enter-from,
  .sticky-continue-leave-to {
    opacity: 1;
    transform: none;
  }
}
</style>
