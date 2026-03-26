<script setup lang="ts">
definePageMeta({ layout: 'admin' });

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

await fetchAppointments();

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

async function updateStatus(id: string, status: string, reason?: string) {
  await api.patch(`/appointments/${id}/status`, { status, cancellationReason: reason });
  await fetchAppointments();
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
}

const formattedDate = computed(() => {
  const [year, month, day] = selectedDate.value.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  return `${dayNames[d.getDay()]}, ${d.getDate()} ${monthNames[d.getMonth()]}`;
});

const statusConfig: Record<string, { label: string; class: string; dot: string }> = {
  CONFIRMED: { label: 'Confirmada', class: 'bg-blue-50 text-[var(--color-primary)] border border-blue-100', dot: 'bg-[var(--color-primary)]' },
  COMPLETED: { label: 'Completada', class: 'bg-emerald-50 text-emerald-700 border border-emerald-100', dot: 'bg-emerald-500' },
  CANCELLED: { label: 'Cancelada', class: 'bg-red-50 text-red-700 border border-red-100', dot: 'bg-red-500' },
  NO_SHOW: { label: 'No asistió', class: 'bg-amber-50 text-amber-700 border border-amber-100', dot: 'bg-amber-500' },
};

const borderColors = ['border-[var(--color-primary)]', 'border-emerald-500', 'border-violet-500', 'border-orange-400', 'border-teal-500', 'border-pink-400'];

function getBorderColor(index: number) {
  return borderColors[index % borderColors.length];
}

function getEmployeeInitials(name: string) {
  return name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2);
}

const isToday = computed(() => selectedDate.value === new Date().toISOString().split('T')[0]);
const showManualForm = ref(false);
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <!-- Top bar -->
    <header class="flex items-center justify-between px-6 h-16 bg-white/80 backdrop-blur-md border-b border-[var(--color-outline-variant)]/10 sticky top-0 z-40 shrink-0">
      <div class="flex items-center bg-[var(--color-surface-container-low)] px-4 py-2 rounded-full w-80">
        <span class="material-symbols-outlined text-[var(--color-outline)] mr-2 text-xl">search</span>
        <input
          class="bg-transparent border-none focus:ring-0 text-sm w-full placeholder:text-[var(--color-outline)] outline-none"
          placeholder="Buscar citas o clientes..."
          type="text"
        />
      </div>
      <div class="flex items-center gap-3">
        <button class="p-2 text-[var(--color-on-surface-variant)] hover:text-[var(--color-on-surface)] transition-colors">
          <span class="material-symbols-outlined">notifications</span>
        </button>
        <button class="p-2 text-[var(--color-on-surface-variant)] hover:text-[var(--color-on-surface)] transition-colors">
          <span class="material-symbols-outlined">help</span>
        </button>
        <button
          class="ml-2 bg-[var(--color-primary)] text-white px-5 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 hover:bg-[var(--color-primary-container)] transition-colors"
          @click="showManualForm = true"
        >
          <span class="material-symbols-outlined text-lg">add</span>
          Nueva Cita
        </button>
        <button
          class="ml-1 p-2 text-[var(--color-on-surface-variant)] hover:text-red-500 transition-colors"
          title="Cerrar sesión"
          @click="logout"
        >
          <span class="material-symbols-outlined">logout</span>
        </button>
      </div>
    </header>

    <!-- Content -->
    <div class="flex-1 overflow-y-auto p-6">

      <!-- Trial banner -->
      <div
        v-if="store.trialDaysRemaining > 0 && store.trialDaysRemaining <= 7"
        class="mb-6 flex items-center gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200"
      >
        <span class="material-symbols-outlined text-amber-600">schedule</span>
        <p class="text-sm text-amber-700">
          Te quedan <strong>{{ store.trialDaysRemaining }}</strong> días de prueba.
          <a href="#" class="font-bold underline ml-1">Actualizar plan →</a>
        </p>
      </div>

      <!-- Header section -->
      <div class="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <h2 class="text-3xl font-extrabold tracking-tight mb-1">{{ formattedDate }}</h2>
          <p class="text-sm font-medium text-[var(--color-on-surface-variant)]">Vista Consolidada del Salón</p>
        </div>
        <div class="flex items-center gap-3">
          <input
            v-model="selectedDate"
            type="date"
            class="bg-[var(--color-surface-container-low)] border-none rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-[var(--color-primary)]/20 outline-none"
          />
        </div>
      </div>

      <!-- Loading -->
      <div v-if="loading && appointments.length === 0" class="flex items-center justify-center py-20 gap-3">
        <div class="w-5 h-5 border-2 border-[var(--color-surface-container-high)] border-t-[var(--color-primary)] rounded-full animate-spin"></div>
        <span class="text-sm text-[var(--color-on-surface-variant)]">Cargando citas...</span>
      </div>

      <!-- Empty state -->
      <div v-else-if="appointments.length === 0" class="flex flex-col items-center justify-center py-20 text-center space-y-3">
        <span class="material-symbols-outlined text-5xl text-[var(--color-outline-variant)]">calendar_today</span>
        <p class="text-lg font-semibold text-[var(--color-on-surface)]">
          {{ isToday ? 'No hay citas para hoy' : 'No hay citas para este día' }}
        </p>
        <p class="text-sm text-[var(--color-on-surface-variant)] max-w-sm">
          Las citas aparecerán aquí cuando tus clientes reserven. Comparte tu enlace:
          <span class="font-bold text-[var(--color-primary)]">agendly.mx/{{ store.tenant?.slug }}</span>
        </p>
      </div>

      <!-- Appointments timeline -->
      <div v-else class="bg-[var(--color-surface-container-lowest)] rounded-2xl editorial-shadow overflow-hidden">
        <div class="p-6 space-y-3">
          <div
            v-for="(appt, index) in appointments"
            :key="appt.id"
            class="flex items-start gap-4 p-4 rounded-xl border-l-4 transition-colors hover:bg-[var(--color-surface-container-low)]/50 group"
            :class="[getBorderColor(index), appt.status === 'CONFIRMED' ? 'bg-[var(--color-secondary-container,#d5e4f7)]/20' : 'bg-[var(--color-surface-container-low)]/30']"
          >
            <!-- Service icon -->
            <div class="p-2.5 bg-white rounded-xl shadow-sm shrink-0">
              <span class="material-symbols-outlined text-[var(--color-on-surface-variant)] text-xl">
                {{ appt.service.name.toLowerCase().includes('corte') ? 'content_cut' :
                   appt.service.name.toLowerCase().includes('manicure') || appt.service.name.toLowerCase().includes('uña') ? 'spa' :
                   appt.service.name.toLowerCase().includes('tinte') ? 'brush' : 'auto_awesome' }}
              </span>
            </div>

            <!-- Info -->
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <h4 class="text-sm font-bold text-[var(--color-on-surface)]">{{ appt.clientName }}</h4>
                <span
                  v-if="statusConfig[appt.status]"
                  class="text-[10px] px-2 py-0.5 rounded-full font-bold"
                  :class="statusConfig[appt.status]?.class"
                >
                  {{ statusConfig[appt.status]?.label }}
                </span>
              </div>
              <p class="text-xs text-[var(--color-on-surface-variant)] font-medium mt-0.5">{{ appt.service.name }}</p>
              <div class="flex items-center gap-3 mt-2 flex-wrap">
                <span class="text-[10px] px-2 py-0.5 bg-white/80 rounded-full font-bold text-[var(--color-on-surface-variant)] flex items-center gap-1 border border-[var(--color-outline-variant)]/20">
                  <span class="material-symbols-outlined text-[12px]">schedule</span>
                  {{ formatTime(appt.startTime) }} — {{ formatTime(appt.endTime) }}
                </span>
                <span class="text-xs text-[var(--color-outline)]">{{ appt.clientPhone }}</span>
              </div>
            </div>

            <!-- Employee + actions -->
            <div class="flex items-center gap-2 shrink-0">
              <div class="w-7 h-7 rounded-full bg-violet-400 flex items-center justify-center text-white text-[10px] font-bold">
                {{ getEmployeeInitials(appt.employee.name) }}
              </div>

              <!-- Action buttons (CONFIRMED only) -->
              <div v-if="appt.status === 'CONFIRMED'" class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  class="text-[10px] px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-100 font-semibold hover:bg-emerald-100 transition-colors"
                  @click="updateStatus(appt.id, 'COMPLETED')"
                >
                  Completar
                </button>
                <button
                  class="text-[10px] px-2 py-1 rounded-lg bg-amber-50 text-amber-700 border border-amber-100 font-semibold hover:bg-amber-100 transition-colors"
                  @click="updateStatus(appt.id, 'NO_SHOW')"
                >
                  No asistió
                </button>
                <button
                  class="text-[10px] px-2 py-1 rounded-lg bg-red-50 text-red-700 border border-red-100 font-semibold hover:bg-red-100 transition-colors"
                  @click="updateStatus(appt.id, 'CANCELLED')"
                >
                  Cancelar
                </button>
              </div>

              <button class="text-[var(--color-on-surface-variant)] hover:text-[var(--color-on-surface)] transition-colors">
                <span class="material-symbols-outlined text-xl">more_vert</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Public URL card -->
      <div class="mt-8 p-5 rounded-2xl bg-[var(--color-primary)]/5 border border-[var(--color-primary)]/10 flex items-center justify-between gap-4">
        <div>
          <p class="text-xs font-bold text-[var(--color-outline)] uppercase tracking-wider mb-1">Tu enlace de reservas</p>
          <p class="font-mono font-semibold text-[var(--color-primary)]">agendly.mx/{{ store.tenant?.slug }}</p>
        </div>
        <button class="text-sm font-semibold text-[var(--color-primary)] flex items-center gap-1.5 bg-white px-4 py-2 rounded-lg border border-[var(--color-primary)]/20 hover:bg-[var(--color-primary)]/5 transition-colors">
          <span class="material-symbols-outlined text-base">content_copy</span>
          Copiar
        </button>
      </div>

    </div>
  </div>
</template>
