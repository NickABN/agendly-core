<script setup lang="ts">
import { formatDateKey, formatTime, todayKey, utcToZonedMinutes } from '@agendly/shared';
import type { AvailabilitySlot } from '~/composables/useAvailability';

const props = defineProps<{
  open: boolean;
  tenantSlug: string;
  defaultDate: string;
}>();

const emit = defineEmits<{
  'update:open': [open: boolean];
  created: [];
}>();

const api = useApi();
const { items: services, load: loadServices } = useServices();
const { items: employees, load: loadEmployees } = useEmployees();
const { slots, loading: loadingSlots, fetchSlots, reset: resetSlots } = useAvailability();

const step = ref<1 | 2 | 3>(1);
const saving = ref(false);
const error = ref('');
const form = ref({
  clientName: '',
  clientPhone: '',
  clientEmail: '',
  serviceId: '',
  employeeId: '',
  date: props.defaultDate,
  selectedSlot: null as AvailabilitySlot | null,
});

const selectedService = computed(() => services.value.find((s) => s.id === form.value.serviceId));
const selectedEmployeeName = computed(
  () => employees.value.find((e) => e.id === form.value.employeeId)?.name || '',
);

const stepSubtitle = computed(() =>
  step.value === 1 ? 'Servicio y profesional' : step.value === 2 ? 'Fecha y horario' : 'Datos del cliente',
);

const slotsByPeriod = computed(() => {
  const morning: AvailabilitySlot[] = [];
  const afternoon: AvailabilitySlot[] = [];
  const evening: AvailabilitySlot[] = [];
  for (const slot of slots.value) {
    const hour = Math.floor(utcToZonedMinutes(slot.start) / 60);
    if (hour < 12) morning.push(slot);
    else if (hour < 17) afternoon.push(slot);
    else evening.push(slot);
  }
  return [
    { key: 'morning', label: 'Mañana', icon: 'light_mode', iconClass: 'text-amber-400', slots: morning },
    { key: 'afternoon', label: 'Tarde', icon: 'wb_sunny', iconClass: 'text-orange-400', slots: afternoon },
    { key: 'evening', label: 'Noche', icon: 'dark_mode', iconClass: 'text-indigo-400', slots: evening },
  ].filter((p) => p.slots.length > 0);
});

function close() {
  emit('update:open', false);
}

function resetForm() {
  form.value = {
    clientName: '',
    clientPhone: '',
    clientEmail: '',
    serviceId: '',
    employeeId: '',
    date: props.defaultDate || todayKey(),
    selectedSlot: null,
  };
  step.value = 1;
  error.value = '';
  resetSlots();
}

function loadSlots() {
  if (!form.value.serviceId || !form.value.employeeId || !form.value.date) return;
  form.value.selectedSlot = null;
  void fetchSlots({
    tenantSlug: props.tenantSlug,
    employeeId: form.value.employeeId,
    serviceId: form.value.serviceId,
    date: form.value.date,
  });
}

function goToStep2() {
  if (!form.value.serviceId || !form.value.employeeId) return;
  step.value = 2;
  loadSlots();
}

async function submit() {
  if (!form.value.clientName || !form.value.clientPhone || !form.value.selectedSlot) return;

  saving.value = true;
  error.value = '';
  try {
    await api.post('/availability/admin/book', {
      clientName: form.value.clientName,
      clientPhone: form.value.clientPhone,
      clientEmail: form.value.clientEmail || undefined,
      serviceId: form.value.serviceId,
      employeeId: form.value.employeeId,
      startTime: form.value.selectedSlot.start,
    });
    close();
    emit('created');
  } catch (e: unknown) {
    const err = e as { data?: { message?: string | string[] } };
    const message = err.data?.message;
    error.value = (Array.isArray(message) ? message[0] : message) || 'Error al crear la cita. Intenta de nuevo.';
  } finally {
    saving.value = false;
  }
}

watch(
  () => props.open,
  (open) => {
    if (open) {
      resetForm();
      void loadServices();
      void loadEmployees();
    }
  },
);

watch(
  () => form.value.date,
  () => {
    if (step.value === 2) loadSlots();
  },
);
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="open" class="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Nueva cita">
        <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" @click="close"></div>
        <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-hidden flex flex-col">
          <!-- Header with stepper -->
          <div class="p-6 pb-4 border-b border-[var(--color-outline-variant)]/10 shrink-0">
            <div class="flex items-center justify-between mb-4">
              <div>
                <h2 class="text-lg font-bold text-[var(--color-on-surface)]">Nueva Cita</h2>
                <p class="text-xs text-[var(--color-on-surface-variant)] mt-0.5">{{ stepSubtitle }}</p>
              </div>
              <button class="p-1.5 hover:bg-slate-100 rounded-lg transition-colors" aria-label="Cerrar" @click="close">
                <span class="material-symbols-outlined text-[var(--color-on-surface-variant)]" aria-hidden="true">close</span>
              </button>
            </div>
            <!-- Step indicator -->
            <div class="flex items-center gap-2">
              <div v-for="s in 3" :key="s" class="flex items-center gap-2 flex-1">
                <div
                  class="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all"
                  :class="step >= s
                    ? 'bg-[var(--color-primary)] text-white'
                    : 'bg-[var(--color-surface-container-high)] text-[var(--color-on-surface-variant)]'"
                >{{ s }}</div>
                <div v-if="s < 3" class="flex-1 h-0.5 rounded-full transition-all" :class="step > s ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-surface-container-high)]'"></div>
              </div>
            </div>
          </div>

          <!-- Content (scrollable) -->
          <div class="flex-1 overflow-y-auto p-6">
            <!-- STEP 1: Service + Employee -->
            <div v-if="step === 1" class="space-y-5">
              <div>
                <p class="block text-xs font-bold text-[var(--color-on-surface-variant)] uppercase tracking-wider mb-3">Servicio</p>
                <div class="grid grid-cols-1 gap-2">
                  <button
                    v-for="s in services"
                    :key="s.id"
                    class="flex items-center gap-3 p-3.5 rounded-xl border-2 text-left transition-all"
                    :class="form.serviceId === s.id
                      ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5'
                      : 'border-[var(--color-outline-variant)]/15 hover:border-[var(--color-outline-variant)]/30 hover:bg-slate-50'"
                    :aria-pressed="form.serviceId === s.id"
                    @click="form.serviceId = s.id"
                  >
                    <div class="flex-1 min-w-0">
                      <p class="text-sm font-semibold text-[var(--color-on-surface)]">{{ s.name }}</p>
                      <p class="text-xs text-[var(--color-on-surface-variant)]">{{ s.durationMinutes }} minutos</p>
                    </div>
                    <span v-if="form.serviceId === s.id" class="material-symbols-outlined text-[var(--color-primary)]" style="font-variation-settings: 'FILL' 1;" aria-hidden="true">check_circle</span>
                  </button>
                </div>
              </div>

              <div>
                <p class="block text-xs font-bold text-[var(--color-on-surface-variant)] uppercase tracking-wider mb-3">Profesional</p>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    v-for="(e, idx) in employees"
                    :key="e.id"
                    class="flex items-center gap-3 p-3.5 rounded-xl border-2 text-left transition-all"
                    :class="form.employeeId === e.id
                      ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5'
                      : 'border-[var(--color-outline-variant)]/15 hover:border-[var(--color-outline-variant)]/30 hover:bg-slate-50'"
                    :aria-pressed="form.employeeId === e.id"
                    @click="form.employeeId = e.id"
                  >
                    <div
                      class="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                      :class="colorForIndex(idx)"
                    >{{ getInitials(e.name) }}</div>
                    <p class="text-sm font-semibold text-[var(--color-on-surface)] truncate">{{ e.name }}</p>
                  </button>
                </div>
              </div>
            </div>

            <!-- STEP 2: Date + Time Slots -->
            <div v-else-if="step === 2" class="space-y-5">
              <div class="flex items-center gap-3 p-3 rounded-xl bg-[var(--color-surface-container-low)]">
                <span class="material-symbols-outlined text-[var(--color-primary)]" aria-hidden="true">auto_awesome</span>
                <div class="text-sm">
                  <span class="font-semibold text-[var(--color-on-surface)]">{{ selectedService?.name }}</span>
                  <span class="text-[var(--color-on-surface-variant)]"> con </span>
                  <span class="font-semibold text-[var(--color-on-surface)]">{{ selectedEmployeeName }}</span>
                  <span class="text-[var(--color-on-surface-variant)]"> · {{ selectedService?.durationMinutes }} min</span>
                </div>
              </div>

              <div>
                <label for="booking-date" class="block text-xs font-bold text-[var(--color-on-surface-variant)] uppercase tracking-wider mb-2">Fecha</label>
                <input
                  id="booking-date"
                  v-model="form.date"
                  type="date"
                  :min="todayKey()"
                  class="w-full px-4 py-2.5 bg-[var(--color-surface-container-low)] border-none rounded-xl text-sm focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:bg-white transition-all outline-none"
                />
              </div>

              <div>
                <div class="flex items-center justify-between mb-3">
                  <p class="text-xs font-bold text-[var(--color-on-surface-variant)] uppercase tracking-wider">Horarios disponibles</p>
                  <span v-if="!loadingSlots && slots.length > 0" class="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                    <span class="w-1.5 h-1.5 rounded-full bg-emerald-500" aria-hidden="true"></span>
                    {{ slots.length }} {{ slots.length === 1 ? 'horario' : 'horarios' }}
                  </span>
                </div>

                <div v-if="loadingSlots" class="flex items-center justify-center py-10 gap-2" role="status">
                  <div class="w-4 h-4 border-2 border-[var(--color-surface-container-high)] border-t-[var(--color-primary)] rounded-full animate-spin" aria-hidden="true"></div>
                  <span class="text-sm text-[var(--color-on-surface-variant)]">Consultando disponibilidad...</span>
                </div>

                <div v-else-if="slots.length === 0" class="text-center py-10 space-y-2">
                  <span class="material-symbols-outlined text-4xl text-[var(--color-outline-variant)]" aria-hidden="true">event_busy</span>
                  <p class="text-sm font-semibold text-[var(--color-on-surface)]">Sin horarios disponibles</p>
                  <p class="text-xs text-[var(--color-on-surface-variant)]">Prueba con otra fecha u otro profesional</p>
                </div>

                <div v-else class="space-y-4">
                  <div v-for="period in slotsByPeriod" :key="period.key">
                    <p class="text-[10px] font-bold uppercase tracking-widest text-[var(--color-on-surface-variant)]/60 mb-2 flex items-center gap-1.5">
                      <span class="material-symbols-outlined text-sm" :class="period.iconClass" aria-hidden="true">{{ period.icon }}</span>
                      {{ period.label }}
                    </p>
                    <div class="flex flex-wrap gap-2">
                      <button
                        v-for="slot in period.slots"
                        :key="slot.start"
                        class="px-3.5 py-2 rounded-xl text-sm font-semibold transition-all"
                        :class="form.selectedSlot?.start === slot.start
                          ? 'bg-[var(--color-primary)] text-white shadow-md shadow-[var(--color-primary)]/20'
                          : 'bg-[var(--color-surface-container-low)] text-[var(--color-on-surface)] hover:bg-[var(--color-surface-container-high)]'"
                        :aria-pressed="form.selectedSlot?.start === slot.start"
                        @click="form.selectedSlot = slot"
                      >{{ formatTime(slot.start) }}</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- STEP 3: Client Info -->
            <div v-else class="space-y-5">
              <div class="p-4 rounded-xl bg-[var(--color-primary)]/5 border border-[var(--color-primary)]/10 space-y-2">
                <div class="flex items-center gap-2">
                  <span class="material-symbols-outlined text-[var(--color-primary)] text-lg" aria-hidden="true">auto_awesome</span>
                  <span class="text-sm font-semibold text-[var(--color-on-surface)]">{{ selectedService?.name }}</span>
                  <span class="text-xs text-[var(--color-on-surface-variant)]">· {{ selectedService?.durationMinutes }} min</span>
                </div>
                <div class="flex items-center gap-2">
                  <span class="material-symbols-outlined text-[var(--color-primary)] text-lg" aria-hidden="true">person</span>
                  <span class="text-sm text-[var(--color-on-surface)]">{{ selectedEmployeeName }}</span>
                </div>
                <div class="flex items-center gap-2">
                  <span class="material-symbols-outlined text-[var(--color-primary)] text-lg" aria-hidden="true">event</span>
                  <span class="text-sm text-[var(--color-on-surface)] capitalize">{{ formatDateKey(form.date) }}</span>
                </div>
                <div class="flex items-center gap-2">
                  <span class="material-symbols-outlined text-[var(--color-primary)] text-lg" aria-hidden="true">schedule</span>
                  <span class="text-sm font-semibold text-[var(--color-on-surface)]">
                    {{ form.selectedSlot ? `${formatTime(form.selectedSlot.start)} — ${formatTime(form.selectedSlot.end)}` : '' }}
                  </span>
                </div>
              </div>

              <div>
                <label for="client-name" class="block text-xs font-bold text-[var(--color-on-surface-variant)] uppercase tracking-wider mb-1.5">Nombre del cliente *</label>
                <input
                  id="client-name"
                  v-model="form.clientName"
                  type="text"
                  placeholder="Ej: María García"
                  class="w-full px-4 py-2.5 bg-[var(--color-surface-container-low)] border-none rounded-xl text-sm focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:bg-white transition-all outline-none"
                />
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label for="client-phone" class="block text-xs font-bold text-[var(--color-on-surface-variant)] uppercase tracking-wider mb-1.5">Teléfono *</label>
                  <input
                    id="client-phone"
                    v-model="form.clientPhone"
                    type="tel"
                    placeholder="55 1234 5678"
                    class="w-full px-4 py-2.5 bg-[var(--color-surface-container-low)] border-none rounded-xl text-sm focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:bg-white transition-all outline-none"
                  />
                </div>
                <div>
                  <label for="client-email" class="block text-xs font-bold text-[var(--color-on-surface-variant)] uppercase tracking-wider mb-1.5">Email <span class="normal-case font-normal">(opcional)</span></label>
                  <input
                    id="client-email"
                    v-model="form.clientEmail"
                    type="email"
                    placeholder="correo@ejemplo.com"
                    class="w-full px-4 py-2.5 bg-[var(--color-surface-container-low)] border-none rounded-xl text-sm focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:bg-white transition-all outline-none"
                  />
                </div>
              </div>

              <div v-if="error" class="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-100">
                <span class="material-symbols-outlined text-red-500 text-lg" aria-hidden="true">error</span>
                <p class="text-sm text-red-700">{{ error }}</p>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div class="p-6 border-t border-[var(--color-outline-variant)]/10 flex items-center shrink-0">
            <button
              v-if="step > 1"
              class="flex items-center gap-1 text-sm font-semibold text-[var(--color-on-surface-variant)] hover:text-[var(--color-on-surface)] transition-colors"
              @click="step--"
            >
              <span class="material-symbols-outlined text-lg" aria-hidden="true">chevron_left</span>
              Atrás
            </button>
            <div class="flex-1"></div>
            <div class="flex gap-3">
              <button
                class="px-4 py-2.5 text-sm font-semibold text-[var(--color-on-surface-variant)] hover:bg-slate-100 rounded-xl transition-colors"
                @click="close"
              >Cancelar</button>

              <button
                v-if="step === 1"
                class="px-5 py-2.5 bg-[var(--color-primary)] text-white rounded-xl text-sm font-semibold hover:bg-[var(--color-primary)]/90 transition-colors disabled:opacity-40"
                :disabled="!form.serviceId || !form.employeeId"
                @click="goToStep2"
              >Elegir horario</button>

              <button
                v-else-if="step === 2"
                class="px-5 py-2.5 bg-[var(--color-primary)] text-white rounded-xl text-sm font-semibold hover:bg-[var(--color-primary)]/90 transition-colors disabled:opacity-40"
                :disabled="!form.selectedSlot"
                @click="step = 3"
              >Datos del cliente</button>

              <button
                v-else
                class="px-5 py-2.5 bg-[var(--color-primary)] text-white rounded-xl text-sm font-semibold hover:bg-[var(--color-primary)]/90 transition-colors disabled:opacity-40 flex items-center gap-2"
                :disabled="saving || !form.clientName || !form.clientPhone"
                @click="submit"
              >
                <div v-if="saving" class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" aria-hidden="true"></div>
                {{ saving ? 'Agendando...' : 'Confirmar Cita' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
