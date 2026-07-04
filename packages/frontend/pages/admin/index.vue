<script setup lang="ts">
import { formatTime as formatTimeTz, utcToZonedMinutes } from '@agendly/shared';

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

type ViewMode = 'day' | 'week' | 'month';
const viewMode = ref<ViewMode>('day');

// Convert any Date or ISO string to local YYYY-MM-DD (avoids UTC shift)
function toLocalDateStr(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ─── Day View ──────────────────────────────
const selectedDate = ref(toLocalDateStr(new Date()));
const appointments = ref<Appointment[]>([]);
const loading = ref(false);

async function fetchDay() {
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

// ─── Week View ─────────────────────────────
const weekStart = ref(getMonday(new Date()));
const weekAppointments = ref<Appointment[]>([]);

function getMonday(d: Date) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  return toLocalDateStr(date);
}

async function fetchWeek() {
  loading.value = true;
  try {
    weekAppointments.value = await api.get<Appointment[]>(
      `/appointments/week?startDate=${weekStart.value}`,
    );
  } catch {
    weekAppointments.value = [];
  } finally {
    loading.value = false;
  }
}

const weekDays = computed(() => {
  const start = new Date(weekStart.value + 'T00:00:00');
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return {
      date: toLocalDateStr(d),
      dayName: d.toLocaleDateString('es-MX', { weekday: 'short' }).replace('.', ''),
      dayNumber: d.getDate(),
      isToday: toLocalDateStr(d) === toLocalDateStr(new Date()),
      isSunday: d.getDay() === 0,
    };
  });
});

function weekAptsForDay(dateStr: string) {
  return weekAppointments.value.filter(
    (a) => toLocalDateStr(a.startTime) === dateStr,
  );
}

function prevWeek() {
  const d = new Date(weekStart.value + 'T00:00:00');
  d.setDate(d.getDate() - 7);
  weekStart.value = toLocalDateStr(d);
}
function nextWeek() {
  const d = new Date(weekStart.value + 'T00:00:00');
  d.setDate(d.getDate() + 7);
  weekStart.value = toLocalDateStr(d);
}

// ─── Month View ────────────────────────────
const monthYear = ref(new Date().getFullYear());
const monthMonth = ref(new Date().getMonth() + 1);
const monthData = ref<Record<string, { count: number; employees: string[] }>>({});

async function fetchMonth() {
  loading.value = true;
  try {
    monthData.value = await api.get<Record<string, { count: number; employees: string[] }>>(
      `/appointments/month?year=${monthYear.value}&month=${monthMonth.value}`,
    );
  } catch {
    monthData.value = {};
  } finally {
    loading.value = false;
  }
}

const monthLabel = computed(() => {
  const d = new Date(monthYear.value, monthMonth.value - 1);
  return d.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
});

const calendarDays = computed(() => {
  const firstDay = new Date(monthYear.value, monthMonth.value - 1, 1);
  const lastDay = new Date(monthYear.value, monthMonth.value, 0);
  // Monday-based: 0=Mon
  let startDow = firstDay.getDay() - 1;
  if (startDow < 0) startDow = 6;

  const days: Array<{ date: string; day: number; currentMonth: boolean; isToday: boolean }> = [];

  // Previous month padding
  for (let i = startDow - 1; i >= 0; i--) {
    const d = new Date(firstDay);
    d.setDate(d.getDate() - i - 1);
    days.push({
      date: toLocalDateStr(d),
      day: d.getDate(),
      currentMonth: false,
      isToday: false,
    });
  }

  // Current month
  const todayStr = toLocalDateStr(new Date());
  for (let d = 1; d <= lastDay.getDate(); d++) {
    const date = new Date(monthYear.value, monthMonth.value - 1, d);
    const dateStr = toLocalDateStr(date);
    days.push({
      date: dateStr,
      day: d,
      currentMonth: true,
      isToday: dateStr === todayStr,
    });
  }

  // Next month padding (fill to 35 or 42)
  const remaining = days.length <= 35 ? 35 - days.length : 42 - days.length;
  for (let i = 1; i <= remaining; i++) {
    const d = new Date(lastDay);
    d.setDate(d.getDate() + i);
    days.push({
      date: toLocalDateStr(d),
      day: d.getDate(),
      currentMonth: false,
      isToday: false,
    });
  }

  return days;
});

function prevMonth() {
  if (monthMonth.value === 1) {
    monthMonth.value = 12;
    monthYear.value--;
  } else {
    monthMonth.value--;
  }
}
function nextMonth() {
  if (monthMonth.value === 12) {
    monthMonth.value = 1;
    monthYear.value++;
  } else {
    monthMonth.value++;
  }
}

function goToDay(dateStr: string) {
  selectedDate.value = dateStr;
  viewMode.value = 'day';
}

// ─── Data fetching by view ─────────────────
watch(viewMode, (mode) => {
  if (mode === 'day') fetchDay();
  else if (mode === 'week') fetchWeek();
  else fetchMonth();
});

watch(selectedDate, () => { if (viewMode.value === 'day') fetchDay(); });
watch(weekStart, () => { if (viewMode.value === 'week') fetchWeek(); });
watch([monthYear, monthMonth], () => { if (viewMode.value === 'month') fetchMonth(); });

// ─── Polling (day view only) ───────────────
let pollInterval: ReturnType<typeof setInterval> | null = null;

function startPolling() {
  stopPolling();
  if (viewMode.value === 'day') {
    pollInterval = setInterval(fetchDay, 15000);
  }
}

function stopPolling() {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
}

watch(viewMode, () => {
  stopPolling();
  if (viewMode.value === 'day') startPolling();
});

onMounted(() => {
  fetchDay();
  startPolling();
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stopPolling();
    } else {
      if (viewMode.value === 'day') { fetchDay(); startPolling(); }
      else if (viewMode.value === 'week') fetchWeek();
      else fetchMonth();
    }
  });
});

onUnmounted(() => stopPolling());

// ─── Shared helpers ────────────────────────
async function updateStatus(id: string, status: string, reason?: string) {
  await api.patch(`/appointments/${id}/status`, { status, cancellationReason: reason });
  if (viewMode.value === 'day') await fetchDay();
  else if (viewMode.value === 'week') await fetchWeek();
}

function formatTime(iso: string) {
  return formatTimeTz(iso);
}

const formattedDate = computed(() => {
  const [year, month, day] = selectedDate.value.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  return `${dayNames[d.getDay()]}, ${d.getDate()} ${monthNames[d.getMonth()]}`;
});

function prevDay() {
  const [y, m, d] = selectedDate.value.split('-').map(Number);
  const date = new Date(y, m - 1, d - 1);
  selectedDate.value = toLocalDateStr(date);
}
function nextDay() {
  const [y, m, d] = selectedDate.value.split('-').map(Number);
  const date = new Date(y, m - 1, d + 1);
  selectedDate.value = toLocalDateStr(date);
}

const weekRangeLabel = computed(() => {
  const start = new Date(weekStart.value + 'T00:00:00');
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const fmt = (d: Date) => `${d.getDate()} ${d.toLocaleDateString('es-MX', { month: 'short' }).replace('.', '')}`;
  return `${fmt(start)} – ${fmt(end)}, ${start.getFullYear()}`;
});

const statusConfig: Record<string, { label: string; class: string; dot: string }> = {
  CONFIRMED: { label: 'Confirmada', class: 'bg-blue-50 text-[var(--color-primary)] border border-blue-100', dot: 'bg-[var(--color-primary)]' },
  COMPLETED: { label: 'Completada', class: 'bg-emerald-50 text-emerald-700 border border-emerald-100', dot: 'bg-emerald-500' },
  CANCELLED: { label: 'Cancelada', class: 'bg-red-50 text-red-700 border border-red-100', dot: 'bg-red-500' },
  NO_SHOW: { label: 'No asistió', class: 'bg-amber-50 text-amber-700 border border-amber-100', dot: 'bg-amber-500' },
};

const borderColors = ['border-[var(--color-primary)]', 'border-emerald-500', 'border-violet-500', 'border-orange-400', 'border-teal-500', 'border-pink-400'];
function getBorderColor(index: number) { return borderColors[index % borderColors.length]; }

function getEmployeeInitials(name: string) {
  return name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2);
}

const employeeColors = ['bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-violet-500', 'bg-pink-500', 'bg-teal-500'];
const employeeColorMap = computed(() => {
  const map = new Map<string, string>();
  const allNames = new Set<string>();
  weekAppointments.value.forEach((a) => allNames.add(a.employee.name));
  let i = 0;
  allNames.forEach((name) => {
    map.set(name, employeeColors[i % employeeColors.length]);
    i++;
  });
  return map;
});

const isToday = computed(() => selectedDate.value === toLocalDateStr(new Date()));
const showManualForm = ref(false);

// ─── Manual booking form ──────────────
interface ServiceOption { id: string; name: string; durationMinutes: number }
interface EmployeeOption { id: string; name: string }
interface TimeSlot { start: string; end: string }

const formServices = ref<ServiceOption[]>([]);
const formEmployees = ref<EmployeeOption[]>([]);
const availableSlots = ref<TimeSlot[]>([]);
const loadingSlots = ref(false);
const bookingStep = ref<1 | 2 | 3>(1);
const bookingForm = ref({
  clientName: '',
  clientPhone: '',
  clientEmail: '',
  serviceId: '',
  employeeId: '',
  date: selectedDate.value,
  selectedSlot: null as TimeSlot | null,
});
const savingBooking = ref(false);
const bookingError = ref('');

const selectedServiceName = computed(() =>
  formServices.value.find((s) => s.id === bookingForm.value.serviceId)?.name || '',
);
const selectedServiceDuration = computed(() =>
  formServices.value.find((s) => s.id === bookingForm.value.serviceId)?.durationMinutes || 0,
);
const selectedEmployeeName = computed(() =>
  formEmployees.value.find((e) => e.id === bookingForm.value.employeeId)?.name || '',
);

async function loadFormData() {
  const [s, e] = await Promise.all([
    api.get<ServiceOption[]>('/services'),
    api.get<EmployeeOption[]>('/employees'),
  ]);
  formServices.value = s;
  formEmployees.value = e;
}

async function fetchSlots() {
  if (!bookingForm.value.serviceId || !bookingForm.value.employeeId || !bookingForm.value.date) return;
  loadingSlots.value = true;
  availableSlots.value = [];
  try {
    const slug = store.tenant?.slug;
    availableSlots.value = await api.get<TimeSlot[]>(
      `/availability/slots?tenantSlug=${slug}&employeeId=${bookingForm.value.employeeId}&serviceId=${bookingForm.value.serviceId}&date=${bookingForm.value.date}`,
    );
  } catch {
    availableSlots.value = [];
  } finally {
    loadingSlots.value = false;
  }
}

const slotsByPeriod = computed(() => {
  const morning: TimeSlot[] = [];
  const afternoon: TimeSlot[] = [];
  const evening: TimeSlot[] = [];
  for (const slot of availableSlots.value) {
    const hour = Math.floor(utcToZonedMinutes(slot.start) / 60);
    if (hour < 12) morning.push(slot);
    else if (hour < 17) afternoon.push(slot);
    else evening.push(slot);
  }
  return { morning, afternoon, evening };
});

function formatSlotTime(iso: string) {
  return formatTimeTz(iso);
}

function goToStep2() {
  if (!bookingForm.value.serviceId || !bookingForm.value.employeeId) return;
  bookingStep.value = 2;
  fetchSlots();
}

function goToStep3() {
  if (!bookingForm.value.selectedSlot) return;
  bookingStep.value = 3;
}

function resetBookingForm() {
  bookingForm.value = {
    clientName: '',
    clientPhone: '',
    clientEmail: '',
    serviceId: '',
    employeeId: '',
    date: selectedDate.value,
    selectedSlot: null,
  };
  bookingStep.value = 1;
  availableSlots.value = [];
  bookingError.value = '';
}

async function submitBooking() {
  if (
    !bookingForm.value.clientName ||
    !bookingForm.value.clientPhone ||
    !bookingForm.value.serviceId ||
    !bookingForm.value.employeeId ||
    !bookingForm.value.selectedSlot
  ) return;

  savingBooking.value = true;
  bookingError.value = '';
  try {
    await api.post('/availability/admin/book', {
      clientName: bookingForm.value.clientName,
      clientPhone: bookingForm.value.clientPhone,
      clientEmail: bookingForm.value.clientEmail || undefined,
      serviceId: bookingForm.value.serviceId,
      employeeId: bookingForm.value.employeeId,
      startTime: bookingForm.value.selectedSlot.start,
    });
    showManualForm.value = false;
    resetBookingForm();
    if (viewMode.value === 'day') await fetchDay();
    else if (viewMode.value === 'week') await fetchWeek();
    else await fetchMonth();
  } catch (e: any) {
    bookingError.value = e?.data?.message || 'Error al crear la cita. Intentá de nuevo.';
  } finally {
    savingBooking.value = false;
  }
}

watch(showManualForm, (v) => {
  if (v) {
    resetBookingForm();
    loadFormData();
  }
});

// Refetch slots when date changes in step 2
watch(() => bookingForm.value.date, () => {
  if (bookingStep.value === 2) {
    bookingForm.value.selectedSlot = null;
    fetchSlots();
  }
});
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <!-- Top bar -->
    <header
      class="flex items-center justify-between px-6 h-16 bg-white/80 backdrop-blur-md border-b border-[var(--color-outline-variant)]/10 sticky top-0 z-40 shrink-0"
    >
      <!-- Left: Nav + view toggle -->
      <div class="flex items-center gap-4">
        <!-- Week/Month navigation -->
        <template v-if="viewMode === 'week'">
          <button class="p-1.5 hover:bg-[var(--color-surface-container-high)] rounded-full transition-colors" @click="prevWeek">
            <span class="material-symbols-outlined text-lg">chevron_left</span>
          </button>
          <h2 class="text-sm font-bold text-[var(--color-on-surface)] min-w-[200px] text-center">{{ weekRangeLabel }}</h2>
          <button class="p-1.5 hover:bg-[var(--color-surface-container-high)] rounded-full transition-colors" @click="nextWeek">
            <span class="material-symbols-outlined text-lg">chevron_right</span>
          </button>
        </template>
        <template v-else-if="viewMode === 'month'">
          <button class="p-1.5 hover:bg-[var(--color-surface-container-high)] rounded-full transition-colors" @click="prevMonth">
            <span class="material-symbols-outlined text-lg">chevron_left</span>
          </button>
          <h2 class="text-sm font-bold text-[var(--color-on-surface)] min-w-[160px] text-center capitalize">{{ monthLabel }}</h2>
          <button class="p-1.5 hover:bg-[var(--color-surface-container-high)] rounded-full transition-colors" @click="nextMonth">
            <span class="material-symbols-outlined text-lg">chevron_right</span>
          </button>
        </template>
        <template v-else>
          <button class="p-1.5 hover:bg-[var(--color-surface-container-high)] rounded-full transition-colors" @click="prevDay">
            <span class="material-symbols-outlined text-lg">chevron_left</span>
          </button>
          <h2 class="text-sm font-bold text-[var(--color-on-surface)] min-w-[200px] text-center">{{ formattedDate }}</h2>
          <button class="p-1.5 hover:bg-[var(--color-surface-container-high)] rounded-full transition-colors" @click="nextDay">
            <span class="material-symbols-outlined text-lg">chevron_right</span>
          </button>
          <button
            v-if="!isToday"
            class="text-xs font-semibold text-[var(--color-primary)] px-3 py-1.5 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
            @click="selectedDate = toLocalDateStr(new Date())"
          >Hoy</button>
        </template>

        <!-- View mode toggle -->
        <div class="flex p-1 bg-[var(--color-surface-container-low)] rounded-xl ml-2">
          <button
            v-for="mode in (['day', 'week', 'month'] as ViewMode[])"
            :key="mode"
            class="px-3 py-1.5 text-xs font-semibold rounded-lg transition-all"
            :class="
              viewMode === mode
                ? 'bg-white shadow-sm text-[var(--color-primary)]'
                : 'text-[var(--color-on-surface-variant)] hover:text-[var(--color-on-surface)]'
            "
            @click="viewMode = mode"
          >
            {{ mode === 'day' ? 'Día' : mode === 'week' ? 'Semana' : 'Mes' }}
          </button>
        </div>
      </div>

      <!-- Right: Actions -->
      <div class="flex items-center gap-3">
        <button class="p-2 text-[var(--color-on-surface-variant)] hover:text-[var(--color-on-surface)] transition-colors">
          <span class="material-symbols-outlined">notifications</span>
        </button>
        <button
          class="bg-[var(--color-primary)] text-white px-5 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 hover:bg-[var(--color-primary-container)] transition-colors"
          @click="showManualForm = true"
        >
          <span class="material-symbols-outlined text-lg">add</span>
          Nueva Cita
        </button>
        <button
          class="p-2 text-[var(--color-on-surface-variant)] hover:text-red-500 transition-colors"
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
          <NuxtLink to="/admin/subscription" class="font-bold underline ml-1">Actualizar plan →</NuxtLink>
        </p>
      </div>

      <!-- ═══ DAY VIEW ═══ -->
      <template v-if="viewMode === 'day'">
        <div class="mb-8">
          <p class="text-sm font-medium text-[var(--color-on-surface-variant)]">Vista Consolidada del Salón</p>
        </div>

        <!-- Loading -->
        <div v-if="loading && appointments.length === 0" class="flex items-center justify-center py-20 gap-3">
          <div class="w-5 h-5 border-2 border-[var(--color-surface-container-high)] border-t-[var(--color-primary)] rounded-full animate-spin"></div>
          <span class="text-sm text-[var(--color-on-surface-variant)]">Cargando citas...</span>
        </div>

        <!-- Empty -->
        <div v-else-if="appointments.length === 0" class="flex flex-col items-center justify-center py-20 text-center space-y-3">
          <span class="material-symbols-outlined text-5xl text-[var(--color-outline-variant)]">calendar_today</span>
          <p class="text-lg font-semibold text-[var(--color-on-surface)]">
            {{ isToday ? 'No hay citas para hoy' : 'No hay citas para este día' }}
          </p>
          <p class="text-sm text-[var(--color-on-surface-variant)] max-w-sm">
            Comparte tu enlace:
            <span class="font-bold text-[var(--color-primary)]">agendly.mx/{{ store.tenant?.slug }}</span>
          </p>
        </div>

        <!-- Appointment list -->
        <div v-else class="bg-[var(--color-surface-container-lowest)] rounded-2xl editorial-shadow overflow-hidden">
          <div class="p-6 space-y-3">
            <div
              v-for="(appt, index) in appointments"
              :key="appt.id"
              class="flex items-start gap-4 p-4 rounded-xl border-l-4 transition-colors hover:bg-[var(--color-surface-container-low)]/50 group"
              :class="[getBorderColor(index), appt.status === 'CONFIRMED' ? 'bg-blue-50/20' : 'bg-[var(--color-surface-container-low)]/30']"
            >
              <div class="p-2.5 bg-white rounded-xl shadow-sm shrink-0">
                <span class="material-symbols-outlined text-[var(--color-on-surface-variant)] text-xl">
                  {{ appt.service.name.toLowerCase().includes('corte') ? 'content_cut' :
                     appt.service.name.toLowerCase().includes('manicure') || appt.service.name.toLowerCase().includes('uña') ? 'spa' :
                     appt.service.name.toLowerCase().includes('tinte') ? 'brush' : 'auto_awesome' }}
                </span>
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <h4 class="text-sm font-bold text-[var(--color-on-surface)]">{{ appt.clientName }}</h4>
                  <span
                    v-if="statusConfig[appt.status]"
                    class="text-[10px] px-2 py-0.5 rounded-full font-bold"
                    :class="statusConfig[appt.status]?.class"
                  >{{ statusConfig[appt.status]?.label }}</span>
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
              <div class="flex items-center gap-2 shrink-0">
                <div class="w-7 h-7 rounded-full bg-violet-400 flex items-center justify-center text-white text-[10px] font-bold">
                  {{ getEmployeeInitials(appt.employee.name) }}
                </div>
                <div v-if="appt.status === 'CONFIRMED'" class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button class="text-[10px] px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-100 font-semibold hover:bg-emerald-100 transition-colors" @click="updateStatus(appt.id, 'COMPLETED')">Completar</button>
                  <button class="text-[10px] px-2 py-1 rounded-lg bg-amber-50 text-amber-700 border border-amber-100 font-semibold hover:bg-amber-100 transition-colors" @click="updateStatus(appt.id, 'NO_SHOW')">No asistió</button>
                  <button class="text-[10px] px-2 py-1 rounded-lg bg-red-50 text-red-700 border border-red-100 font-semibold hover:bg-red-100 transition-colors" @click="updateStatus(appt.id, 'CANCELLED')">Cancelar</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Public URL -->
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
      </template>

      <!-- ═══ WEEK VIEW ═══ -->
      <template v-else-if="viewMode === 'week'">
        <!-- Loading -->
        <div v-if="loading && weekAppointments.length === 0" class="flex items-center justify-center py-20 gap-3">
          <div class="w-5 h-5 border-2 border-[var(--color-surface-container-high)] border-t-[var(--color-primary)] rounded-full animate-spin"></div>
          <span class="text-sm text-[var(--color-on-surface-variant)]">Cargando semana...</span>
        </div>

        <div v-else class="min-w-[900px]">
          <!-- Day headers -->
          <div class="grid grid-cols-7 mb-4 gap-4">
            <div
              v-for="wd in weekDays"
              :key="wd.date"
              class="text-center py-2"
            >
              <span
                class="block text-xs font-bold uppercase tracking-wider"
                :class="wd.isToday ? 'text-[var(--color-primary)]' : wd.isSunday ? 'text-red-400' : 'text-[var(--color-on-surface-variant)]/60'"
              >{{ wd.dayName }}</span>
              <span
                class="inline-block text-2xl font-bold mt-1"
                :class="wd.isToday ? 'text-[var(--color-primary)] bg-blue-50 px-3 py-1 rounded-full' : ''"
              >{{ wd.dayNumber }}</span>
            </div>
          </div>

          <!-- 7-column grid -->
          <div class="grid grid-cols-7 gap-4">
            <div
              v-for="wd in weekDays"
              :key="wd.date"
              class="min-h-[500px] rounded-xl p-3 space-y-3"
              :class="wd.isToday ? 'bg-[var(--color-primary)]/5 border border-[var(--color-primary)]/10' : 'bg-[var(--color-surface-container-low)]'"
            >
              <template v-if="weekAptsForDay(wd.date).length > 0">
                <div
                  v-for="appt in weekAptsForDay(wd.date)"
                  :key="appt.id"
                  class="bg-white p-3 rounded-xl shadow-sm border border-[var(--color-outline-variant)]/10 hover:shadow-md transition-shadow cursor-pointer"
                  :class="appt.status === 'CANCELLED' ? 'opacity-50' : ''"
                  @click="goToDay(wd.date)"
                >
                  <span class="text-[10px] font-bold uppercase" :class="wd.isToday ? 'text-[var(--color-primary)]' : 'text-[var(--color-on-surface-variant)]/70'">
                    {{ formatTime(appt.startTime) }} - {{ formatTime(appt.endTime) }}
                  </span>
                  <h4 class="font-bold text-sm mt-1 text-[var(--color-on-surface)]" :class="appt.status === 'CANCELLED' ? 'line-through' : ''">
                    {{ appt.clientName }}
                  </h4>
                  <p class="text-xs text-[var(--color-on-surface-variant)]">{{ appt.service.name }}</p>
                  <div class="mt-2 flex items-center justify-between">
                    <div class="flex items-center gap-1.5">
                      <div class="w-2 h-2 rounded-full" :class="employeeColorMap.get(appt.employee.name) || 'bg-slate-400'"></div>
                      <span class="text-[10px] font-medium text-[var(--color-on-surface-variant)]">{{ appt.employee.name.split(' ')[0] }}</span>
                    </div>
                  </div>
                </div>
              </template>
              <div
                v-else
                class="h-full flex items-center justify-center"
              >
                <p v-if="wd.isSunday" class="text-xs text-[var(--color-on-surface-variant)]/40">
                  <span class="material-symbols-outlined text-2xl text-[var(--color-outline-variant)]/30">event_busy</span>
                </p>
                <p v-else class="text-xs text-[var(--color-on-surface-variant)]/40">Sin citas</p>
              </div>
            </div>
          </div>
        </div>
      </template>

      <!-- ═══ MONTH VIEW ═══ -->
      <template v-else>
        <div class="flex flex-1 gap-0 overflow-hidden">
          <!-- Calendar grid -->
          <div class="flex-1">
            <!-- Weekday headers -->
            <div class="grid grid-cols-7 mb-4">
              <div
                v-for="dayName in ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']"
                :key="dayName"
                class="text-center text-xs font-bold text-[var(--color-on-surface-variant)] tracking-widest uppercase py-2"
              >{{ dayName }}</div>
            </div>

            <!-- Days grid -->
            <div class="grid grid-cols-7 bg-[var(--color-outline-variant)]/10 gap-[1px] rounded-xl overflow-hidden border border-[var(--color-outline-variant)]/20 shadow-sm">
              <div
                v-for="cd in calendarDays"
                :key="cd.date"
                class="min-h-[120px] p-3 flex flex-col cursor-pointer transition-colors"
                :class="[
                  cd.currentMonth ? 'bg-white hover:bg-[var(--color-surface-container-lowest)]' : 'bg-[var(--color-surface-container-low)] opacity-40',
                  cd.isToday ? 'border-2 border-[var(--color-primary)] bg-[var(--color-primary)]/5' : '',
                ]"
                @click="cd.currentMonth && goToDay(cd.date)"
              >
                <div class="flex items-center justify-between mb-2">
                  <span
                    class="text-sm font-semibold"
                    :class="cd.isToday ? 'text-[var(--color-primary)] font-bold' : ''"
                  >{{ cd.day }}</span>
                  <span
                    v-if="cd.isToday"
                    class="text-[9px] uppercase font-black text-[var(--color-primary)] bg-blue-50 px-1.5 py-0.5 rounded"
                  >Hoy</span>
                </div>
                <!-- Appointment dots -->
                <div v-if="monthData[cd.date]" class="mt-auto flex flex-wrap gap-1 justify-end items-end">
                  <div
                    v-for="(emp, ei) in monthData[cd.date].employees.slice(0, 3)"
                    :key="emp"
                    class="w-2.5 h-2.5 rounded-full"
                    :class="employeeColors[ei % employeeColors.length]"
                    :title="emp"
                  ></div>
                  <span
                    v-if="monthData[cd.date].count > 3"
                    class="text-[10px] font-bold text-[var(--color-on-surface-variant)] leading-none"
                  >+{{ monthData[cd.date].count - 3 }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Day detail sidebar (month view) -->
          <aside
            v-if="selectedDate && monthData[selectedDate]"
            class="w-80 bg-white border-l border-[var(--color-outline-variant)]/20 ml-6 rounded-xl shadow-sm overflow-hidden flex flex-col shrink-0"
          >
            <div class="p-6 border-b border-[var(--color-outline-variant)]/20">
              <p class="text-xs font-bold uppercase tracking-widest text-[var(--color-primary)] mb-1">
                {{ new Date(selectedDate + 'T00:00:00').toLocaleDateString('es-MX', { weekday: 'long' }) }}
              </p>
              <h3 class="text-2xl font-extrabold text-[var(--color-on-surface)] capitalize">
                {{ new Date(selectedDate + 'T00:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'long' }) }}
              </h3>
              <p class="text-sm text-[var(--color-on-surface-variant)] mt-1">
                {{ monthData[selectedDate].count }} {{ monthData[selectedDate].count === 1 ? 'cita' : 'citas' }}
              </p>
            </div>
            <div class="p-4">
              <button
                class="w-full py-2.5 text-sm font-semibold text-[var(--color-primary)] bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                @click="goToDay(selectedDate)"
              >
                Ver detalle del día →
              </button>
            </div>
          </aside>
        </div>
      </template>

    </div>

    <!-- Nueva Cita Modal -->
    <Teleport to="body">
      <Transition name="fade">
        <div v-if="showManualForm" class="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" @click="showManualForm = false"></div>
          <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-hidden flex flex-col">
            <!-- Header with stepper -->
            <div class="p-6 pb-4 border-b border-[var(--color-outline-variant)]/10 shrink-0">
              <div class="flex items-center justify-between mb-4">
                <div>
                  <h2 class="text-lg font-bold text-[var(--color-on-surface)]">Nueva Cita</h2>
                  <p class="text-xs text-[var(--color-on-surface-variant)] mt-0.5">
                    {{ bookingStep === 1 ? 'Servicio y profesional' : bookingStep === 2 ? 'Fecha y horario' : 'Datos del cliente' }}
                  </p>
                </div>
                <button class="p-1.5 hover:bg-slate-100 rounded-lg transition-colors" @click="showManualForm = false">
                  <span class="material-symbols-outlined text-[var(--color-on-surface-variant)]">close</span>
                </button>
              </div>
              <!-- Step indicator -->
              <div class="flex items-center gap-2">
                <div v-for="step in 3" :key="step" class="flex items-center gap-2 flex-1">
                  <div
                    class="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all"
                    :class="bookingStep >= step
                      ? 'bg-[var(--color-primary)] text-white'
                      : 'bg-[var(--color-surface-container-high)] text-[var(--color-on-surface-variant)]'"
                  >{{ step }}</div>
                  <div v-if="step < 3" class="flex-1 h-0.5 rounded-full transition-all" :class="bookingStep > step ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-surface-container-high)]'"></div>
                </div>
              </div>
            </div>

            <!-- Content (scrollable) -->
            <div class="flex-1 overflow-y-auto p-6">

              <!-- STEP 1: Service + Employee -->
              <div v-if="bookingStep === 1" class="space-y-5">
                <!-- Service selection as cards -->
                <div>
                  <label class="block text-xs font-bold text-[var(--color-on-surface-variant)] uppercase tracking-wider mb-3">Servicio</label>
                  <div class="grid grid-cols-1 gap-2">
                    <button
                      v-for="s in formServices"
                      :key="s.id"
                      class="flex items-center gap-3 p-3.5 rounded-xl border-2 text-left transition-all"
                      :class="bookingForm.serviceId === s.id
                        ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5'
                        : 'border-[var(--color-outline-variant)]/15 hover:border-[var(--color-outline-variant)]/30 hover:bg-slate-50'"
                      @click="bookingForm.serviceId = s.id"
                    >
                      <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" :class="bookingForm.serviceId === s.id ? 'bg-[var(--color-primary)]/10' : 'bg-[var(--color-surface-container-high)]'">
                        <span class="material-symbols-outlined text-lg" :class="bookingForm.serviceId === s.id ? 'text-[var(--color-primary)]' : 'text-[var(--color-on-surface-variant)]'">
                          {{ s.name.toLowerCase().includes('corte') ? 'content_cut' :
                             s.name.toLowerCase().includes('manicure') || s.name.toLowerCase().includes('uña') ? 'spa' :
                             s.name.toLowerCase().includes('tinte') || s.name.toLowerCase().includes('color') ? 'brush' : 'auto_awesome' }}
                        </span>
                      </div>
                      <div class="flex-1 min-w-0">
                        <p class="text-sm font-semibold text-[var(--color-on-surface)]">{{ s.name }}</p>
                        <p class="text-xs text-[var(--color-on-surface-variant)]">{{ s.durationMinutes }} minutos</p>
                      </div>
                      <span v-if="bookingForm.serviceId === s.id" class="material-symbols-outlined text-[var(--color-primary)]" style="font-variation-settings: 'FILL' 1;">check_circle</span>
                    </button>
                  </div>
                </div>

                <!-- Employee selection as cards -->
                <div>
                  <label class="block text-xs font-bold text-[var(--color-on-surface-variant)] uppercase tracking-wider mb-3">Profesional</label>
                  <div class="grid grid-cols-2 gap-2">
                    <button
                      v-for="(e, idx) in formEmployees"
                      :key="e.id"
                      class="flex items-center gap-3 p-3.5 rounded-xl border-2 text-left transition-all"
                      :class="bookingForm.employeeId === e.id
                        ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5'
                        : 'border-[var(--color-outline-variant)]/15 hover:border-[var(--color-outline-variant)]/30 hover:bg-slate-50'"
                      @click="bookingForm.employeeId = e.id"
                    >
                      <div
                        class="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                        :class="employeeColors[idx % employeeColors.length]"
                      >{{ getEmployeeInitials(e.name) }}</div>
                      <div class="flex-1 min-w-0">
                        <p class="text-sm font-semibold text-[var(--color-on-surface)] truncate">{{ e.name }}</p>
                      </div>
                    </button>
                  </div>
                </div>
              </div>

              <!-- STEP 2: Date + Time Slots -->
              <div v-else-if="bookingStep === 2" class="space-y-5">
                <!-- Selected summary -->
                <div class="flex items-center gap-3 p-3 rounded-xl bg-[var(--color-surface-container-low)]">
                  <span class="material-symbols-outlined text-[var(--color-primary)]">auto_awesome</span>
                  <div class="text-sm">
                    <span class="font-semibold text-[var(--color-on-surface)]">{{ selectedServiceName }}</span>
                    <span class="text-[var(--color-on-surface-variant)]"> con </span>
                    <span class="font-semibold text-[var(--color-on-surface)]">{{ selectedEmployeeName }}</span>
                    <span class="text-[var(--color-on-surface-variant)]"> · {{ selectedServiceDuration }} min</span>
                  </div>
                </div>

                <!-- Date picker -->
                <div>
                  <label class="block text-xs font-bold text-[var(--color-on-surface-variant)] uppercase tracking-wider mb-2">Fecha</label>
                  <input
                    v-model="bookingForm.date"
                    type="date"
                    class="w-full px-4 py-2.5 bg-[var(--color-surface-container-low)] border-none rounded-xl text-sm focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:bg-white transition-all outline-none"
                  />
                </div>

                <!-- Available slots -->
                <div>
                  <div class="flex items-center justify-between mb-3">
                    <label class="text-xs font-bold text-[var(--color-on-surface-variant)] uppercase tracking-wider">Horarios disponibles</label>
                    <span v-if="!loadingSlots && availableSlots.length > 0" class="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                      <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      {{ availableSlots.length }} {{ availableSlots.length === 1 ? 'horario' : 'horarios' }}
                    </span>
                  </div>

                  <!-- Loading slots -->
                  <div v-if="loadingSlots" class="flex items-center justify-center py-10 gap-2">
                    <div class="w-4 h-4 border-2 border-[var(--color-surface-container-high)] border-t-[var(--color-primary)] rounded-full animate-spin"></div>
                    <span class="text-sm text-[var(--color-on-surface-variant)]">Consultando disponibilidad...</span>
                  </div>

                  <!-- No slots -->
                  <div v-else-if="availableSlots.length === 0" class="text-center py-10 space-y-2">
                    <span class="material-symbols-outlined text-4xl text-[var(--color-outline-variant)]">event_busy</span>
                    <p class="text-sm font-semibold text-[var(--color-on-surface)]">Sin horarios disponibles</p>
                    <p class="text-xs text-[var(--color-on-surface-variant)]">Probá con otra fecha o profesional</p>
                  </div>

                  <!-- Slots grouped by period -->
                  <div v-else class="space-y-4">
                    <!-- Morning -->
                    <div v-if="slotsByPeriod.morning.length > 0">
                      <p class="text-[10px] font-bold uppercase tracking-widest text-[var(--color-on-surface-variant)]/60 mb-2 flex items-center gap-1.5">
                        <span class="material-symbols-outlined text-sm text-amber-400">light_mode</span>
                        Mañana
                      </p>
                      <div class="flex flex-wrap gap-2">
                        <button
                          v-for="slot in slotsByPeriod.morning"
                          :key="slot.start"
                          class="px-3.5 py-2 rounded-xl text-sm font-semibold transition-all"
                          :class="bookingForm.selectedSlot?.start === slot.start
                            ? 'bg-[var(--color-primary)] text-white shadow-md shadow-[var(--color-primary)]/20'
                            : 'bg-[var(--color-surface-container-low)] text-[var(--color-on-surface)] hover:bg-[var(--color-surface-container-high)]'"
                          @click="bookingForm.selectedSlot = slot"
                        >{{ formatSlotTime(slot.start) }}</button>
                      </div>
                    </div>

                    <!-- Afternoon -->
                    <div v-if="slotsByPeriod.afternoon.length > 0">
                      <p class="text-[10px] font-bold uppercase tracking-widest text-[var(--color-on-surface-variant)]/60 mb-2 flex items-center gap-1.5">
                        <span class="material-symbols-outlined text-sm text-orange-400">wb_sunny</span>
                        Tarde
                      </p>
                      <div class="flex flex-wrap gap-2">
                        <button
                          v-for="slot in slotsByPeriod.afternoon"
                          :key="slot.start"
                          class="px-3.5 py-2 rounded-xl text-sm font-semibold transition-all"
                          :class="bookingForm.selectedSlot?.start === slot.start
                            ? 'bg-[var(--color-primary)] text-white shadow-md shadow-[var(--color-primary)]/20'
                            : 'bg-[var(--color-surface-container-low)] text-[var(--color-on-surface)] hover:bg-[var(--color-surface-container-high)]'"
                          @click="bookingForm.selectedSlot = slot"
                        >{{ formatSlotTime(slot.start) }}</button>
                      </div>
                    </div>

                    <!-- Evening -->
                    <div v-if="slotsByPeriod.evening.length > 0">
                      <p class="text-[10px] font-bold uppercase tracking-widest text-[var(--color-on-surface-variant)]/60 mb-2 flex items-center gap-1.5">
                        <span class="material-symbols-outlined text-sm text-indigo-400">dark_mode</span>
                        Noche
                      </p>
                      <div class="flex flex-wrap gap-2">
                        <button
                          v-for="slot in slotsByPeriod.evening"
                          :key="slot.start"
                          class="px-3.5 py-2 rounded-xl text-sm font-semibold transition-all"
                          :class="bookingForm.selectedSlot?.start === slot.start
                            ? 'bg-[var(--color-primary)] text-white shadow-md shadow-[var(--color-primary)]/20'
                            : 'bg-[var(--color-surface-container-low)] text-[var(--color-on-surface)] hover:bg-[var(--color-surface-container-high)]'"
                          @click="bookingForm.selectedSlot = slot"
                        >{{ formatSlotTime(slot.start) }}</button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- STEP 3: Client Info -->
              <div v-else class="space-y-5">
                <!-- Booking summary -->
                <div class="p-4 rounded-xl bg-[var(--color-primary)]/5 border border-[var(--color-primary)]/10 space-y-2">
                  <div class="flex items-center gap-2">
                    <span class="material-symbols-outlined text-[var(--color-primary)] text-lg">auto_awesome</span>
                    <span class="text-sm font-semibold text-[var(--color-on-surface)]">{{ selectedServiceName }}</span>
                    <span class="text-xs text-[var(--color-on-surface-variant)]">· {{ selectedServiceDuration }} min</span>
                  </div>
                  <div class="flex items-center gap-2">
                    <span class="material-symbols-outlined text-[var(--color-primary)] text-lg">person</span>
                    <span class="text-sm text-[var(--color-on-surface)]">{{ selectedEmployeeName }}</span>
                  </div>
                  <div class="flex items-center gap-2">
                    <span class="material-symbols-outlined text-[var(--color-primary)] text-lg">event</span>
                    <span class="text-sm text-[var(--color-on-surface)]">
                      {{ new Date(bookingForm.date + 'T00:00:00').toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' }) }}
                    </span>
                  </div>
                  <div class="flex items-center gap-2">
                    <span class="material-symbols-outlined text-[var(--color-primary)] text-lg">schedule</span>
                    <span class="text-sm font-semibold text-[var(--color-on-surface)]">
                      {{ bookingForm.selectedSlot ? `${formatSlotTime(bookingForm.selectedSlot.start)} — ${formatSlotTime(bookingForm.selectedSlot.end)}` : '' }}
                    </span>
                  </div>
                </div>

                <!-- Client fields -->
                <div>
                  <label class="block text-xs font-bold text-[var(--color-on-surface-variant)] uppercase tracking-wider mb-1.5">Nombre del cliente *</label>
                  <input
                    v-model="bookingForm.clientName"
                    type="text"
                    placeholder="Ej: María García"
                    class="w-full px-4 py-2.5 bg-[var(--color-surface-container-low)] border-none rounded-xl text-sm focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:bg-white transition-all outline-none"
                  />
                </div>
                <div class="grid grid-cols-2 gap-3">
                  <div>
                    <label class="block text-xs font-bold text-[var(--color-on-surface-variant)] uppercase tracking-wider mb-1.5">Teléfono *</label>
                    <input
                      v-model="bookingForm.clientPhone"
                      type="tel"
                      placeholder="55 1234 5678"
                      class="w-full px-4 py-2.5 bg-[var(--color-surface-container-low)] border-none rounded-xl text-sm focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:bg-white transition-all outline-none"
                    />
                  </div>
                  <div>
                    <label class="block text-xs font-bold text-[var(--color-on-surface-variant)] uppercase tracking-wider mb-1.5">Email <span class="normal-case font-normal">(opcional)</span></label>
                    <input
                      v-model="bookingForm.clientEmail"
                      type="email"
                      placeholder="correo@ejemplo.com"
                      class="w-full px-4 py-2.5 bg-[var(--color-surface-container-low)] border-none rounded-xl text-sm focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:bg-white transition-all outline-none"
                    />
                  </div>
                </div>

                <!-- Error message -->
                <div v-if="bookingError" class="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-100">
                  <span class="material-symbols-outlined text-red-500 text-lg">error</span>
                  <p class="text-sm text-red-700">{{ bookingError }}</p>
                </div>
              </div>
            </div>

            <!-- Footer -->
            <div class="p-6 border-t border-[var(--color-outline-variant)]/10 flex items-center shrink-0">
              <button
                v-if="bookingStep > 1"
                class="flex items-center gap-1 text-sm font-semibold text-[var(--color-on-surface-variant)] hover:text-[var(--color-on-surface)] transition-colors"
                @click="bookingStep--"
              >
                <span class="material-symbols-outlined text-lg">chevron_left</span>
                Atrás
              </button>
              <div class="flex-1"></div>
              <div class="flex gap-3">
                <button
                  class="px-4 py-2.5 text-sm font-semibold text-[var(--color-on-surface-variant)] hover:bg-slate-100 rounded-xl transition-colors"
                  @click="showManualForm = false"
                >Cancelar</button>

                <!-- Step 1 → 2 -->
                <button
                  v-if="bookingStep === 1"
                  class="px-5 py-2.5 bg-[var(--color-primary)] text-white rounded-xl text-sm font-semibold hover:bg-[var(--color-primary)]/90 transition-colors disabled:opacity-40"
                  :disabled="!bookingForm.serviceId || !bookingForm.employeeId"
                  @click="goToStep2"
                >Elegir horario</button>

                <!-- Step 2 → 3 -->
                <button
                  v-else-if="bookingStep === 2"
                  class="px-5 py-2.5 bg-[var(--color-primary)] text-white rounded-xl text-sm font-semibold hover:bg-[var(--color-primary)]/90 transition-colors disabled:opacity-40"
                  :disabled="!bookingForm.selectedSlot"
                  @click="goToStep3"
                >Datos del cliente</button>

                <!-- Step 3 → Submit -->
                <button
                  v-else
                  class="px-5 py-2.5 bg-[var(--color-primary)] text-white rounded-xl text-sm font-semibold hover:bg-[var(--color-primary)]/90 transition-colors disabled:opacity-40 flex items-center gap-2"
                  :disabled="savingBooking || !bookingForm.clientName || !bookingForm.clientPhone"
                  @click="submitBooking"
                >
                  <div v-if="savingBooking" class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  {{ savingBooking ? 'Agendando...' : 'Confirmar Cita' }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
