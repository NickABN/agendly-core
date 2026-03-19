<script setup lang="ts">
const { store, logout } = useAuth();
const api = useApi();

interface Appointment {
  id: string;
  clientName: string;
  clientPhone: string;
  clientEmail: string | null;
  startTime: string;
  endTime: string;
  status: string;
  channel: string;
  employee: { id: string; name: string };
  service: { id: string; name: string; durationMinutes: number };
}

const selectedDate = ref(new Date().toISOString().split('T')[0]);
const appointments = ref<Appointment[]>([]);
const loading = ref(false);

async function fetchAppointments() {
  loading.value = true;
  try {
    appointments.value = await api.get<Appointment[]>(
      `/appointments/day?date=${selectedDate.value}`,
    );
  } catch {
    appointments.value = [];
  } finally {
    loading.value = false;
  }
}

// Initial fetch
await fetchAppointments();

// Poll every 15 seconds when page is visible
let pollInterval: ReturnType<typeof setInterval> | null = null;

function startPolling() {
  stopPolling();
  pollInterval = setInterval(fetchAppointments, 15000);
}

function stopPolling() {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
}

onMounted(() => {
  startPolling();
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stopPolling();
    } else {
      fetchAppointments();
      startPolling();
    }
  });
});

onUnmounted(() => stopPolling());

watch(selectedDate, fetchAppointments);

// Status actions
async function updateStatus(id: string, status: string, reason?: string) {
  await api.patch(`/appointments/${id}/status`, { status, cancellationReason: reason });
  await fetchAppointments();
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
}

const statusColors: Record<string, string> = {
  CONFIRMED: 'info',
  COMPLETED: 'success',
  CANCELLED: 'error',
  NO_SHOW: 'warning',
};

const statusLabels: Record<string, string> = {
  CONFIRMED: 'Confirmada',
  COMPLETED: 'Completada',
  CANCELLED: 'Cancelada',
  NO_SHOW: 'No asistió',
};

// Create manual appointment (walk-in)
const showManualForm = ref(false);
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Header -->
    <header class="bg-white border-b px-4 py-3 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <h1 class="text-xl font-bold text-primary">Agendly</h1>
        <span class="text-sm text-gray-500 hidden sm:inline">{{ store.tenant?.name }}</span>
      </div>
      <div class="flex items-center gap-2">
        <NuxtLink to="/admin/config">
          <UButton variant="ghost" size="sm" icon="i-heroicons-cog-6-tooth">Configuración</UButton>
        </NuxtLink>
        <UButton variant="ghost" size="sm" @click="logout">Salir</UButton>
      </div>
    </header>

    <div class="p-4 max-w-5xl mx-auto">
      <!-- Trial banner -->
      <div
        v-if="store.trialDaysRemaining > 0 && store.trialDaysRemaining <= 7"
        class="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200"
      >
        <p class="text-sm text-amber-700">
          Te quedan <strong>{{ store.trialDaysRemaining }}</strong> días de prueba.
        </p>
      </div>

      <!-- Date picker + actions -->
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-3">
          <h2 class="text-lg font-semibold">Citas del día</h2>
          <UInput v-model="selectedDate" type="date" size="sm" />
        </div>
      </div>

      <!-- Loading -->
      <div v-if="loading && appointments.length === 0" class="text-center py-12">
        <p class="text-gray-500">Cargando citas...</p>
      </div>

      <!-- Empty state -->
      <div v-else-if="appointments.length === 0" class="text-center py-12">
        <p class="text-gray-400 text-lg mb-2">No hay citas para este día</p>
        <p class="text-gray-400 text-sm">Las citas aparecerán aquí cuando tus clientes reserven</p>
      </div>

      <!-- Appointment list -->
      <div v-else class="space-y-3">
        <div
          v-for="appt in appointments"
          :key="appt.id"
          class="bg-white rounded-lg border p-4"
        >
          <div class="flex items-start justify-between">
            <div class="flex-1">
              <div class="flex items-center gap-2 mb-1">
                <span class="font-semibold">{{ formatTime(appt.startTime) }} — {{ formatTime(appt.endTime) }}</span>
                <UBadge :color="(statusColors[appt.status] as any) || 'neutral'" size="xs">
                  {{ statusLabels[appt.status] || appt.status }}
                </UBadge>
              </div>
              <p class="text-sm font-medium">{{ appt.clientName }}</p>
              <p class="text-sm text-gray-500">
                {{ appt.service.name }} · {{ appt.employee.name }}
              </p>
              <p class="text-xs text-gray-400 mt-1">
                {{ appt.clientPhone }}
                <span v-if="appt.clientEmail"> · {{ appt.clientEmail }}</span>
              </p>
            </div>

            <!-- Actions -->
            <div v-if="appt.status === 'CONFIRMED'" class="flex gap-1">
              <UButton
                size="xs"
                color="success"
                variant="soft"
                @click="updateStatus(appt.id, 'COMPLETED')"
              >
                Completar
              </UButton>
              <UButton
                size="xs"
                color="warning"
                variant="soft"
                @click="updateStatus(appt.id, 'NO_SHOW')"
              >
                No asistió
              </UButton>
              <UButton
                size="xs"
                color="error"
                variant="soft"
                @click="updateStatus(appt.id, 'CANCELLED')"
              >
                Cancelar
              </UButton>
            </div>
          </div>
        </div>
      </div>

      <!-- Public URL -->
      <div class="mt-8 p-4 rounded-lg bg-primary/5 border border-primary/20 text-center">
        <p class="text-sm text-gray-600 mb-1">Comparte tu página de reservas</p>
        <p class="font-medium text-primary">agendly.mx/{{ store.tenant?.slug }}</p>
      </div>
    </div>
  </div>
</template>
