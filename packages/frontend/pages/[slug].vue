<script setup lang="ts">
import { formatTime } from '@agendly/shared';

definePageMeta({ layout: 'public' });

const route = useRoute();
const config = useRuntimeConfig();
const apiUrl = config.public.apiUrl;
const slug = route.params.slug as string;

// State
const step = ref(1); // 1=service, 2=employee, 3=date+time, 4=client info
const loading = ref(false);
const error = ref('');
const success = ref(false);

// Fetch tenant data
const { data: tenantData, error: fetchError } = await useAsyncData(`public-${slug}`, () =>
  $fetch<{
    tenant: { name: string; slug: string };
    services: Array<{ id: string; name: string; durationMinutes: number; priceMXN: string }>;
    employees: Array<{ id: string; name: string; serviceIds: string[] }>;
  }>(`${apiUrl}/public/${slug}`),
);

const tenantName = computed(() => tenantData.value?.tenant.name ?? '');
const services = computed(() => tenantData.value?.services ?? []);
const employees = computed(() => tenantData.value?.employees ?? []);

// Selection
const selectedServiceId = ref('');
const selectedEmployeeId = ref('');
const selectedDate = ref('');
const selectedSlot = ref('');
const availableSlots = ref<Array<{ start: string; end: string; employeeId?: string }>>([]);

// Client form
const clientForm = reactive({
  name: '',
  phone: '',
  email: '',
  privacyAccepted: false,
});

// Computed
const filteredEmployees = computed(() => {
  if (!selectedServiceId.value) return [];
  return employees.value.filter((e) => e.serviceIds.includes(selectedServiceId.value));
});

const selectedService = computed(() =>
  services.value.find((s) => s.id === selectedServiceId.value),
);

const selectedEmployee = computed(() =>
  employees.value.find((e) => e.id === selectedEmployeeId.value),
);

const selectedEmployeeName = computed(() => {
  if (selectedEmployeeId.value === 'any') return 'Cualquier disponible';
  return selectedEmployee.value?.name ?? '';
});

function formatDate(dateStr: string) {
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const monthNames = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return `${dayNames[d.getDay()]} ${d.getDate()} ${monthNames[d.getMonth()]}`;
}

// The backend resolves "any" server-side: slots come back tagged with the
// concrete employeeId that is actually free at that time.
const selectedSlotEmployeeId = computed(() => {
  const slot = availableSlots.value.find((s) => s.start === selectedSlot.value);
  return slot?.employeeId ?? selectedEmployeeId.value;
});

async function fetchSlots() {
  if (!selectedEmployeeId.value || !selectedDate.value || !selectedServiceId.value) return;
  loading.value = true;
  selectedSlot.value = '';
  try {
    availableSlots.value = await $fetch<Array<{ start: string; end: string; employeeId?: string }>>(
      `${apiUrl}/availability/slots`,
      {
        params: {
          tenantSlug: slug,
          employeeId: selectedEmployeeId.value,
          serviceId: selectedServiceId.value,
          date: selectedDate.value,
        },
      },
    );
  } catch {
    availableSlots.value = [];
  } finally {
    loading.value = false;
  }
}

watch([selectedEmployeeId, selectedDate], fetchSlots);

// Navigation
function selectService(id: string) {
  selectedServiceId.value = id;
  selectedEmployeeId.value = '';
  selectedDate.value = '';
  selectedSlot.value = '';
  availableSlots.value = [];

  const available = employees.value.filter((e) => e.serviceIds.includes(id));
  if (available.length === 1) {
    selectedEmployeeId.value = available[0].id;
    step.value = 3; // skip employee step
  } else {
    step.value = 2;
  }
}

function selectEmployee(id: string) {
  selectedEmployeeId.value = id;
  selectedDate.value = '';
  selectedSlot.value = '';
  availableSlots.value = [];
  step.value = 3;
}

function goToClientForm() {
  if (!selectedSlot.value) return;
  step.value = 4;
}

async function submitBooking() {
  if (!clientForm.privacyAccepted) {
    error.value = 'Debes aceptar el aviso de privacidad';
    return;
  }
  loading.value = true;
  error.value = '';
  try {
    await $fetch(`${apiUrl}/availability/book?tenantSlug=${slug}`, {
      method: 'POST',
      body: {
        employeeId: selectedSlotEmployeeId.value,
        serviceId: selectedServiceId.value,
        startTime: selectedSlot.value,
        clientName: clientForm.name,
        clientPhone: clientForm.phone,
        clientEmail: clientForm.email || undefined,
        channel: 'WEB',
      },
    });
    success.value = true;
  } catch (e: unknown) {
    const err = e as { data?: { message?: string } };
    error.value = err.data?.message || 'Error al crear la cita';
  } finally {
    loading.value = false;
  }
}

const progressStep = computed(() => Math.min(step.value, 4));
</script>

<template>
  <div class="min-h-screen bg-[var(--color-surface)] font-['Inter',sans-serif]">

    <!-- Success: full-screen confirmation -->
    <BookingConfirmationScreen
      v-if="success"
      :service-name="selectedService?.name ?? ''"
      :employee-name="selectedEmployeeName"
      :date="selectedDate"
      :time="formatTime(selectedSlot)"
      :tenant-name="tenantName"
    />

    <!-- Not found -->
    <div v-else-if="fetchError" class="flex flex-col items-center justify-center min-h-screen px-6 text-center space-y-4">
      <span class="material-symbols-outlined text-5xl text-[var(--color-outline-variant)]">search_off</span>
      <p class="font-semibold text-[var(--color-on-surface)]">Negocio no encontrado</p>
      <p class="text-sm text-[var(--color-on-surface-variant)]">Verifica el enlace e intenta de nuevo.</p>
    </div>

    <!-- Booking flow -->
    <template v-else>
      <!-- Sticky header -->
      <header class="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-[var(--color-outline-variant)]/10">
        <div class="max-w-sm mx-auto flex items-center justify-between px-4 h-14">
          <!-- Back button -->
          <button
            v-if="step > 1"
            class="flex items-center gap-1 text-[var(--color-primary)] text-sm font-medium"
            @click="step--"
          >
            <span class="material-symbols-outlined text-lg">arrow_back</span>
          </button>
          <div v-else class="w-8"></div>

          <!-- Logo -->
          <span class="font-bold text-[var(--color-on-surface)] tracking-tight">Agendly</span>

          <!-- Avatar placeholder -->
          <div class="w-8 h-8 rounded-full bg-[var(--color-surface-container-high)] flex items-center justify-center">
            <span class="material-symbols-outlined text-sm text-[var(--color-on-surface-variant)]">person</span>
          </div>
        </div>

        <!-- Progress bar -->
        <BookingProgressBar :current="progressStep" :total="4" />
      </header>

      <div class="max-w-sm mx-auto px-4 py-6 pb-24">

        <!-- Business header (step 1 only) -->
        <div v-if="step === 1" class="mb-6 space-y-1">
          <div class="flex items-center gap-2">
            <span class="material-symbols-outlined text-emerald-500 text-lg" style="font-variation-settings: 'FILL' 1">verified</span>
            <h1 class="text-2xl font-bold text-[var(--color-on-surface)] leading-tight">{{ tenantName }}</h1>
          </div>
          <p class="text-sm text-[var(--color-on-surface-variant)]">Reserva tu experiencia de bienestar</p>
        </div>

        <!-- Step chips for step > 1 -->
        <div v-if="step > 1" class="flex flex-wrap gap-2 mb-5">
          <div class="inline-flex items-center gap-1.5 bg-blue-50 text-[var(--color-primary)] rounded-full px-3 py-1 text-xs font-semibold border border-[var(--color-primary)]/10">
            <span class="material-symbols-outlined text-sm" style="font-variation-settings: 'FILL' 1">content_cut</span>
            {{ selectedService?.name }} · {{ selectedService?.durationMinutes }} min
          </div>
          <div v-if="step > 2 && selectedEmployeeName" class="inline-flex items-center gap-1.5 bg-blue-50 text-[var(--color-primary)] rounded-full px-3 py-1 text-xs font-semibold border border-[var(--color-primary)]/10">
            <span class="material-symbols-outlined text-sm">person</span>
            {{ selectedEmployeeName }}
          </div>
          <div v-if="step === 4 && selectedSlot" class="inline-flex items-center gap-1.5 bg-blue-50 text-[var(--color-primary)] rounded-full px-3 py-1 text-xs font-semibold border border-[var(--color-primary)]/10">
            <span class="material-symbols-outlined text-sm">schedule</span>
            {{ formatDate(selectedDate) }} · {{ formatTime(selectedSlot) }}
          </div>
        </div>

        <!-- STEP 1: Service selection -->
        <div v-if="step === 1">
          <h2 class="text-lg font-bold text-[var(--color-on-surface)] mb-4">¿Qué servicio necesitas?</h2>
          <div class="space-y-3">
            <BookingServiceCard
              v-for="s in services"
              :key="s.id"
              :name="s.name"
              :duration-minutes="s.durationMinutes"
              :price="s.priceMXN"
              :selected="selectedServiceId === s.id"
              @select="selectService(s.id)"
            />
          </div>

          <!-- CTA after selection -->
          <button
            v-if="selectedServiceId"
            class="w-full mt-6 soul-gradient text-white py-4 rounded-xl font-bold text-base flex items-center justify-center gap-2 shadow-lg shadow-[var(--color-primary)]/20 active:scale-[0.98] transition-all"
            @click="selectService(selectedServiceId)"
          >
            Elegir Especialista
            <span class="material-symbols-outlined">arrow_forward</span>
          </button>
        </div>

        <!-- STEP 2: Employee selection -->
        <div v-if="step === 2">
          <h2 class="text-lg font-bold text-[var(--color-on-surface)] mb-1">Selecciona tu especialista</h2>
          <p class="text-sm text-[var(--color-on-surface-variant)] mb-5">Elige con quién quieres tu cita</p>

          <BookingEmployeeSelector
            :employees="filteredEmployees"
            :model-value="selectedEmployeeId"
            @update:model-value="selectEmployee($event)"
          />
        </div>

        <!-- STEP 3: Date + time -->
        <div v-if="step === 3" class="space-y-6">
          <div>
            <h2 class="text-lg font-bold text-[var(--color-on-surface)] mb-1">Selecciona tu horario</h2>
            <p class="text-sm text-[var(--color-on-surface-variant)]">{{ selectedService?.name }} · {{ selectedService?.durationMinutes }} min</p>
          </div>

          <!-- Date tabs -->
          <div>
            <p class="text-xs font-bold text-[var(--color-outline)] uppercase tracking-wider mb-3">¿Qué día?</p>
            <BookingDayTabs v-model="selectedDate" />
          </div>

          <!-- Time slots -->
          <div v-if="selectedDate || loading">
            <p class="text-xs font-bold text-[var(--color-outline)] uppercase tracking-wider mb-3">Horarios disponibles</p>
            <BookingSlotGrid
              :slots="availableSlots"
              :model-value="selectedSlot"
              :loading="loading"
              :has-date="!!selectedDate"
              @update:model-value="selectedSlot = $event"
            />
          </div>

          <!-- CTA -->
          <button
            v-if="selectedSlot"
            class="w-full soul-gradient text-white py-4 rounded-xl font-bold text-base flex items-center justify-center gap-2 shadow-lg shadow-[var(--color-primary)]/20 active:scale-[0.98] transition-all"
            @click="goToClientForm"
          >
            Continuar al paso final
            <span class="material-symbols-outlined">arrow_forward</span>
          </button>

          <button
            class="w-full text-center text-sm text-[var(--color-on-surface-variant)] hover:text-[var(--color-primary)] transition-colors"
            @click="step = 1"
          >
            Regresar a servicios
          </button>
        </div>

        <!-- STEP 4: Client info -->
        <div v-if="step === 4">
          <!-- Summary card -->
          <div class="bg-white rounded-2xl p-5 mb-6 shadow-sm border border-[var(--color-outline-variant)]/10 space-y-3">
            <p class="text-xs font-bold text-[var(--color-outline)] uppercase tracking-wider">Resumen de la cita</p>
            <div class="grid grid-cols-2 gap-3">
              <div class="space-y-1">
                <div class="flex items-center gap-1.5">
                  <span class="material-symbols-outlined text-[var(--color-primary)] text-base">content_cut</span>
                  <span class="text-xs font-bold text-[var(--color-outline)] uppercase tracking-wider">Servicio</span>
                </div>
                <p class="text-sm font-semibold text-[var(--color-on-surface)]">{{ selectedService?.name }}</p>
              </div>
              <div class="space-y-1">
                <div class="flex items-center gap-1.5">
                  <span class="material-symbols-outlined text-[var(--color-primary)] text-base">person</span>
                  <span class="text-xs font-bold text-[var(--color-outline)] uppercase tracking-wider">Especialista</span>
                </div>
                <p class="text-sm font-semibold text-[var(--color-on-surface)]">{{ selectedEmployeeName }}</p>
              </div>
              <div class="space-y-1">
                <div class="flex items-center gap-1.5">
                  <span class="material-symbols-outlined text-[var(--color-primary)] text-base">event</span>
                  <span class="text-xs font-bold text-[var(--color-outline)] uppercase tracking-wider">Fecha</span>
                </div>
                <p class="text-sm font-semibold text-[var(--color-on-surface)]">{{ formatDate(selectedDate) }}</p>
              </div>
              <div class="space-y-1">
                <div class="flex items-center gap-1.5">
                  <span class="material-symbols-outlined text-[var(--color-primary)] text-base">payments</span>
                  <span class="text-xs font-bold text-[var(--color-outline)] uppercase tracking-wider">Precio est.</span>
                </div>
                <p class="text-sm font-semibold text-[var(--color-on-surface)]">${{ selectedService?.priceMXN }} MXN</p>
              </div>
            </div>
          </div>

          <h2 class="text-lg font-bold text-[var(--color-on-surface)] mb-5">Tus datos</h2>

          <!-- Error -->
          <div v-if="error" class="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
            <span class="material-symbols-outlined text-lg">error</span>
            {{ error }}
          </div>

          <form class="space-y-4" @submit.prevent="submitBooking">
            <div class="space-y-2">
              <label class="text-xs font-bold text-[var(--color-outline)] uppercase tracking-wider">Nombre completo</label>
              <input
                v-model="clientForm.name"
                required
                type="text"
                placeholder="Ej. Alex García"
                autocomplete="name"
                class="w-full bg-[var(--color-surface-container-high)] border-none rounded-xl px-5 py-4 focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:bg-[var(--color-surface-container-lowest)] outline-none transition-all placeholder:text-[var(--color-outline)]/50"
              />
            </div>

            <div class="space-y-2">
              <label class="text-xs font-bold text-[var(--color-outline)] uppercase tracking-wider">Teléfono móvil</label>
              <input
                v-model="clientForm.phone"
                required
                type="tel"
                inputmode="numeric"
                placeholder="+52 000 000 0000"
                autocomplete="tel"
                class="w-full bg-[var(--color-surface-container-high)] border-none rounded-xl px-5 py-4 focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:bg-[var(--color-surface-container-lowest)] outline-none transition-all placeholder:text-[var(--color-outline)]/50"
              />
            </div>

            <div class="space-y-2">
              <label class="text-xs font-bold text-[var(--color-outline)] uppercase tracking-wider">Email <span class="normal-case font-normal text-[var(--color-outline)]">(opcional)</span></label>
              <input
                v-model="clientForm.email"
                type="email"
                placeholder="Para recibir confirmación"
                autocomplete="email"
                class="w-full bg-[var(--color-surface-container-high)] border-none rounded-xl px-5 py-4 focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:bg-[var(--color-surface-container-lowest)] outline-none transition-all placeholder:text-[var(--color-outline)]/50"
              />
            </div>

            <label class="flex items-start gap-3 cursor-pointer">
              <input
                v-model="clientForm.privacyAccepted"
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
              :disabled="loading"
              class="w-full soul-gradient text-white py-4 rounded-full font-bold text-base flex items-center justify-center gap-2 shadow-lg shadow-[var(--color-primary)]/20 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 1">check_circle</span>
              {{ loading ? 'Confirmando...' : 'Confirmar cita' }}
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
