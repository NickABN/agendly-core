<script setup lang="ts">
definePageMeta({ layout: 'public' });

const route = useRoute();
const config = useRuntimeConfig();
const apiUrl = config.public.apiUrl;
const slug = route.params.slug as string;

// State
const step = ref(1); // 1=service, 2=employee+date+time, 3=client info
const loading = ref(false);
const error = ref('');
const success = ref(false);

// Data from API
const tenantName = ref('');
const services = ref<Array<{ id: string; name: string; durationMinutes: number; priceMXN: string }>>([]);
const employees = ref<Array<{ id: string; name: string; serviceIds: string[] }>>([]);

// Selection
const selectedServiceId = ref('');
const selectedEmployeeId = ref('');
const selectedDate = ref('');
const selectedSlot = ref('');
const availableSlots = ref<Array<{ start: string; end: string }>>([]);

// Client form
const clientForm = reactive({
  name: '',
  phone: '',
  email: '',
  privacyAccepted: false,
});

// Fetch tenant data
const { error: fetchError } = await useAsyncData(`public-${slug}`, async () => {
  const data = await $fetch<{
    tenant: { name: string; slug: string };
    services: Array<{ id: string; name: string; durationMinutes: number; priceMXN: string }>;
    employees: Array<{ id: string; name: string; serviceIds: string[] }>;
  }>(`${apiUrl}/public/${slug}`);

  tenantName.value = data.tenant.name;
  services.value = data.services;
  employees.value = data.employees;
  return data;
});

// Computed: employees that offer the selected service
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

// Minimum date is today
const minDate = computed(() => {
  const d = new Date();
  return d.toISOString().split('T')[0];
});

// Format slot time
function formatTime(isoString: string) {
  const [, time] = isoString.split('T');
  const [h, m] = time.split(':');
  const hour = parseInt(h);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${m} ${ampm}`;
}

// Fetch available slots when employee + date are selected
async function fetchSlots() {
  if (!selectedEmployeeId.value || !selectedDate.value || !selectedServiceId.value) return;

  loading.value = true;
  selectedSlot.value = '';
  try {
    availableSlots.value = await $fetch<Array<{ start: string; end: string }>>(
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
  step.value = 2;
}

function goToClientForm() {
  if (!selectedSlot.value) return;
  step.value = 3;
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
        employeeId: selectedEmployeeId.value,
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
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Header -->
    <header class="bg-white border-b px-4 py-4 text-center">
      <h1 class="text-xl font-bold">{{ tenantName }}</h1>
      <p class="text-sm text-gray-500">Reserva tu cita en línea</p>
    </header>

    <div class="max-w-lg mx-auto p-4">
      <!-- Not found -->
      <div v-if="fetchError" class="text-center py-12">
        <p class="text-gray-500">Negocio no encontrado</p>
      </div>

      <!-- Success -->
      <UCard v-else-if="success" class="text-center">
        <div class="py-6">
          <div class="text-4xl mb-3">✅</div>
          <h2 class="text-lg font-semibold mb-2">¡Cita confirmada!</h2>
          <p class="text-gray-600 mb-4">
            {{ selectedService?.name }} con {{ selectedEmployee?.name }}
          </p>
          <p class="text-sm text-gray-500">
            {{ selectedDate }} a las {{ formatTime(selectedSlot) }}
          </p>
          <p class="text-sm text-gray-400 mt-4">
            Recibirás un correo de confirmación.
          </p>
        </div>
      </UCard>

      <!-- Step 1: Select service -->
      <div v-else-if="step === 1">
        <h2 class="text-lg font-semibold mb-4">¿Qué servicio necesitas?</h2>
        <div class="space-y-3">
          <button
            v-for="s in services"
            :key="s.id"
            class="w-full p-4 bg-white rounded-lg border border-gray-200 text-left hover:border-primary hover:bg-primary/5 transition"
            @click="selectService(s.id)"
          >
            <div class="flex justify-between items-center">
              <div>
                <p class="font-medium">{{ s.name }}</p>
                <p class="text-sm text-gray-500">{{ s.durationMinutes }} min</p>
              </div>
              <span class="font-semibold">${{ s.priceMXN }}</span>
            </div>
          </button>
        </div>
      </div>

      <!-- Step 2: Employee + Date + Time -->
      <div v-else-if="step === 2">
        <button class="text-sm text-primary mb-4 flex items-center gap-1" @click="step = 1">
          ← Cambiar servicio
        </button>

        <div class="bg-white rounded-lg border p-3 mb-4">
          <span class="text-sm text-gray-500">Servicio:</span>
          <span class="font-medium ml-1">{{ selectedService?.name }}</span>
        </div>

        <div class="space-y-4">
          <!-- Employee selection -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              ¿Con quién?
            </label>
            <div class="grid grid-cols-2 gap-2">
              <button
                v-for="e in filteredEmployees"
                :key="e.id"
                class="p-3 rounded-lg border text-center transition"
                :class="selectedEmployeeId === e.id
                  ? 'border-primary bg-primary/5 font-medium'
                  : 'border-gray-200 hover:border-gray-300'"
                @click="selectedEmployeeId = e.id"
              >
                {{ e.name }}
              </button>
            </div>
          </div>

          <!-- Date selection -->
          <UFormField v-if="selectedEmployeeId" label="¿Qué día?">
            <UInput
              v-model="selectedDate"
              type="date"
              :min="minDate"
              size="lg"
            />
          </UFormField>

          <!-- Time slots -->
          <div v-if="availableSlots.length > 0">
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Horarios disponibles
            </label>
            <div class="grid grid-cols-3 gap-2">
              <button
                v-for="slot in availableSlots"
                :key="slot.start"
                class="p-2 rounded-lg border text-center text-sm transition"
                :class="selectedSlot === slot.start
                  ? 'border-primary bg-primary text-white font-medium'
                  : 'border-gray-200 hover:border-gray-300'"
                @click="selectedSlot = slot.start"
              >
                {{ formatTime(slot.start) }}
              </button>
            </div>
          </div>

          <div v-else-if="selectedDate && !loading" class="text-center py-4">
            <p class="text-gray-500 text-sm">No hay horarios disponibles para esta fecha</p>
          </div>

          <div v-if="loading" class="text-center py-4">
            <p class="text-gray-500 text-sm">Cargando horarios...</p>
          </div>

          <UButton
            v-if="selectedSlot"
            block
            size="lg"
            @click="goToClientForm"
          >
            Continuar
          </UButton>
        </div>
      </div>

      <!-- Step 3: Client info -->
      <div v-else-if="step === 3">
        <button class="text-sm text-primary mb-4 flex items-center gap-1" @click="step = 2">
          ← Cambiar horario
        </button>

        <div class="bg-white rounded-lg border p-3 mb-4 space-y-1">
          <p class="text-sm">
            <span class="text-gray-500">Servicio:</span>
            <span class="font-medium ml-1">{{ selectedService?.name }}</span>
          </p>
          <p class="text-sm">
            <span class="text-gray-500">Con:</span>
            <span class="font-medium ml-1">{{ selectedEmployee?.name }}</span>
          </p>
          <p class="text-sm">
            <span class="text-gray-500">Fecha:</span>
            <span class="font-medium ml-1">{{ selectedDate }}</span>
          </p>
          <p class="text-sm">
            <span class="text-gray-500">Hora:</span>
            <span class="font-medium ml-1">{{ formatTime(selectedSlot) }}</span>
          </p>
        </div>

        <UCard>
          <template #header>
            <h2 class="text-lg font-semibold">Tus datos</h2>
          </template>

          <form class="space-y-4" @submit.prevent="submitBooking">
            <UAlert v-if="error" color="error" :title="error" />

            <UFormField label="Nombre completo">
              <UInput v-model="clientForm.name" required size="lg" placeholder="Tu nombre" />
            </UFormField>

            <UFormField label="Teléfono">
              <UInput v-model="clientForm.phone" required size="lg" type="tel" placeholder="10 dígitos" />
            </UFormField>

            <UFormField label="Email (opcional)">
              <UInput v-model="clientForm.email" size="lg" type="email" placeholder="tu@email.com" />
            </UFormField>

            <label class="flex items-start gap-2 text-sm">
              <input v-model="clientForm.privacyAccepted" type="checkbox" class="mt-1" />
              <span class="text-gray-600">
                Acepto el
                <NuxtLink to="/privacidad" target="_blank" class="text-primary underline">
                  aviso de privacidad
                </NuxtLink>
                y autorizo el uso de mis datos para esta cita.
              </span>
            </label>

            <UButton type="submit" block size="lg" :loading="loading">
              Confirmar cita
            </UButton>
          </form>
        </UCard>
      </div>

      <!-- Footer -->
      <p class="text-center text-xs text-gray-400 mt-8">
        Agenda gestionada por <span class="font-medium">Agendly</span>
      </p>
    </div>
  </div>
</template>
