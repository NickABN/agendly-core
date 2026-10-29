<script setup lang="ts">
import { formatDate, formatTime, todayKey, utcToDateKey } from '@agendly/shared';
import type { TimeSlotDto } from '@agendly/shared';
import type { CalendarAppointment } from '~/composables/useAppointmentsCalendar';

const props = defineProps<{
  open: boolean;
  appointment: CalendarAppointment | null;
}>();

const emit = defineEmits<{
  'update:open': [open: boolean];
  rescheduled: [];
}>();

const timezone = useBusinessTimezone();
const { items: employees, load: loadEmployees } = useEmployees();
const { slots, loadingSlots, fetchSlots, reset, reschedule } = useReschedule();

const employeeId = ref('');
const date = ref('');
const selectedSlot = ref<TimeSlotDto | null>(null);
const saving = ref(false);
const error = ref('');

/** Only active employees who offer the appointment's service can take it. */
const eligibleEmployees = computed(() =>
  props.appointment
    ? employees.value.filter(
        (e) => e.isActive && e.serviceIds.includes(props.appointment!.service.id),
      )
    : [],
);

const isCurrentSlot = (slot: TimeSlotDto) =>
  !!props.appointment &&
  slot.start === new Date(props.appointment.startTime).toISOString() &&
  employeeId.value === props.appointment.employee.id;

function close() {
  emit('update:open', false);
}

function loadSlots() {
  if (!props.appointment || !employeeId.value || !date.value) return;
  selectedSlot.value = null;
  void fetchSlots(props.appointment.id, date.value, employeeId.value);
}

async function submit() {
  if (!props.appointment || !selectedSlot.value) return;
  saving.value = true;
  error.value = '';
  try {
    await reschedule(props.appointment.id, {
      startTime: selectedSlot.value.start,
      employeeId: employeeId.value,
    });
    close();
    emit('rescheduled');
  } catch (e: unknown) {
    const err = e as { data?: { message?: string | string[] } };
    const message = err.data?.message;
    error.value =
      (Array.isArray(message) ? message[0] : message) ||
      'No se pudo reagendar la cita. Intenta de nuevo.';
    // The slot may have just been taken: refresh the list.
    loadSlots();
  } finally {
    saving.value = false;
  }
}

watch(
  () => props.open,
  (open) => {
    if (!open || !props.appointment) return;
    error.value = '';
    reset();
    employeeId.value = props.appointment.employee.id;
    const today = todayKey(timezone.value);
    const current = utcToDateKey(props.appointment.startTime, timezone.value);
    date.value = current < today ? today : current;
    void loadEmployees();
    loadSlots();
  },
);

watch([employeeId, date], () => {
  if (props.open) loadSlots();
});
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="open && appointment"
        class="fixed inset-0 z-[100] flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        aria-label="Reagendar cita"
      >
        <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" @click="close"></div>
        <div
          class="relative bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-hidden flex flex-col"
        >
          <div
            class="p-5 md:p-6 pb-4 border-b border-[var(--color-outline-variant)]/10 shrink-0 flex items-start justify-between gap-3"
          >
            <div class="min-w-0">
              <h2 class="text-lg font-bold text-[var(--color-on-surface)]">Reagendar cita</h2>
              <p class="text-xs text-[var(--color-on-surface-variant)] mt-0.5 truncate">
                {{ appointment.clientName }} · {{ appointment.service.name }}
              </p>
              <p
                class="text-xs text-[var(--color-on-surface-variant)] mt-0.5 first-letter:uppercase"
              >
                Actual: {{ formatDate(appointment.startTime, 'long', timezone) }},
                {{ formatTime(appointment.startTime, timezone) }} con
                {{ appointment.employee.name }}
              </p>
            </div>
            <button
              class="p-1.5 hover:bg-slate-100 rounded-lg transition-colors shrink-0"
              aria-label="Cerrar"
              @click="close"
            >
              <span
                class="material-symbols-outlined text-[var(--color-on-surface-variant)]"
                aria-hidden="true"
                >close</span
              >
            </button>
          </div>

          <div class="flex-1 overflow-y-auto p-5 md:p-6 space-y-5">
            <div>
              <p
                class="text-xs font-bold text-[var(--color-on-surface-variant)] uppercase tracking-wider mb-2"
              >
                Profesional
              </p>
              <div class="flex flex-wrap gap-2">
                <button
                  v-for="e in eligibleEmployees"
                  :key="e.id"
                  class="px-3.5 py-2 rounded-xl text-sm font-semibold border-2 transition-all"
                  :class="
                    employeeId === e.id
                      ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5 text-[var(--color-on-surface)]'
                      : 'border-[var(--color-outline-variant)]/15 text-[var(--color-on-surface-variant)] hover:bg-slate-50'
                  "
                  :aria-pressed="employeeId === e.id"
                  @click="employeeId = e.id"
                >
                  {{ e.name }}
                </button>
              </div>
            </div>

            <div>
              <label
                for="reschedule-date"
                class="block text-xs font-bold text-[var(--color-on-surface-variant)] uppercase tracking-wider mb-2"
                >Nueva fecha</label
              >
              <input
                id="reschedule-date"
                v-model="date"
                type="date"
                :min="todayKey(timezone)"
                class="w-full px-4 py-2.5 bg-[var(--color-surface-container-low)] border-none rounded-xl text-sm focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:bg-white transition-all outline-none"
              />
            </div>

            <div>
              <p
                class="text-xs font-bold text-[var(--color-on-surface-variant)] uppercase tracking-wider mb-3"
              >
                Horarios disponibles
              </p>
              <div
                v-if="loadingSlots"
                class="flex items-center justify-center py-8 gap-2"
                role="status"
              >
                <div
                  class="w-4 h-4 border-2 border-[var(--color-surface-container-high)] border-t-[var(--color-primary)] rounded-full animate-spin"
                  aria-hidden="true"
                ></div>
                <span class="text-sm text-[var(--color-on-surface-variant)]"
                  >Consultando disponibilidad...</span
                >
              </div>
              <p
                v-else-if="slots.length === 0"
                class="text-sm text-[var(--color-on-surface-variant)] text-center py-8"
              >
                Sin horarios disponibles. Prueba con otra fecha u otro profesional.
              </p>
              <div v-else class="flex flex-wrap gap-2">
                <button
                  v-for="slot in slots"
                  :key="slot.start"
                  class="px-3.5 py-2 rounded-xl text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  :class="
                    selectedSlot?.start === slot.start
                      ? 'bg-[var(--color-primary)] text-white shadow-md shadow-[var(--color-primary)]/20'
                      : 'bg-[var(--color-surface-container-low)] text-[var(--color-on-surface)] hover:bg-[var(--color-surface-container-high)]'
                  "
                  :disabled="isCurrentSlot(slot)"
                  :title="isCurrentSlot(slot) ? 'Horario actual' : undefined"
                  :aria-pressed="selectedSlot?.start === slot.start"
                  @click="selectedSlot = slot"
                >
                  {{ formatTime(slot.start, timezone) }}
                </button>
              </div>
            </div>

            <p
              v-if="appointment.clientEmail"
              class="text-xs text-[var(--color-on-surface-variant)] flex items-center gap-1.5"
            >
              <span class="material-symbols-outlined text-sm" aria-hidden="true">mail</span>
              Le enviaremos un correo al cliente con el nuevo horario.
            </p>
            <p v-else class="text-xs text-amber-700 flex items-center gap-1.5">
              <span class="material-symbols-outlined text-sm" aria-hidden="true">call</span>
              Este cliente no dejó correo: avísale por teléfono ({{ appointment.clientPhone }}).
            </p>

            <div
              v-if="error"
              class="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-100"
              role="alert"
            >
              <span class="material-symbols-outlined text-red-500 text-lg" aria-hidden="true"
                >error</span
              >
              <p class="text-sm text-red-700">{{ error }}</p>
            </div>
          </div>

          <div
            class="p-5 md:p-6 border-t border-[var(--color-outline-variant)]/10 flex justify-end gap-3 shrink-0"
          >
            <button
              class="px-4 py-2.5 text-sm font-semibold text-[var(--color-on-surface-variant)] hover:bg-slate-100 rounded-xl transition-colors"
              @click="close"
            >
              Cancelar
            </button>
            <button
              class="px-5 py-2.5 bg-[var(--color-primary)] text-white rounded-xl text-sm font-semibold hover:bg-[var(--color-primary)]/90 transition-colors disabled:opacity-40 flex items-center gap-2"
              :disabled="saving || !selectedSlot"
              @click="submit"
            >
              <div
                v-if="saving"
                class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"
                aria-hidden="true"
              ></div>
              {{ saving ? 'Reagendando...' : 'Reagendar' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
