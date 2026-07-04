<script setup lang="ts">
import type { ServiceAvailabilityItem, ServiceItem } from '~/composables/useServices';

const props = defineProps<{
  service: ServiceItem | null;
}>();

const emit = defineEmits<{
  close: [];
}>();

const DAY_LABELS: Record<string, string> = {
  MONDAY: 'Lunes',
  TUESDAY: 'Martes',
  WEDNESDAY: 'Miércoles',
  THURSDAY: 'Jueves',
  FRIDAY: 'Viernes',
  SATURDAY: 'Sábado',
  SUNDAY: 'Domingo',
};
const DAYS_ORDER = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];

const { getAvailability, setAvailability } = useServices();

const items = ref<ServiceAvailabilityItem[]>([]);
const enabled = ref(false);
const pending = ref(false);
const saving = ref(false);

watch(
  () => props.service,
  async (service) => {
    if (!service) return;
    pending.value = true;
    try {
      const data = await getAvailability(service.id);
      items.value = data;
      enabled.value = data.length > 0;
    } finally {
      pending.value = false;
    }
  },
  { immediate: true },
);

function toggleEnabled() {
  enabled.value = !enabled.value;
  if (enabled.value && items.value.length === 0) {
    // Default: available Mon-Sat all day
    items.value = DAYS_ORDER.filter((d) => d !== 'SUNDAY').map((d) => ({
      dayOfWeek: d,
      startTime: '09:00',
      endTime: '19:00',
    }));
  }
}

function isDayActive(day: string) {
  return items.value.some((i) => i.dayOfWeek === day);
}

function toggleDay(day: string) {
  if (isDayActive(day)) {
    items.value = items.value.filter((i) => i.dayOfWeek !== day);
  } else {
    items.value.push({ dayOfWeek: day, startTime: '09:00', endTime: '19:00' });
  }
}

function itemFor(day: string) {
  return items.value.find((i) => i.dayOfWeek === day);
}

async function save() {
  if (!props.service) return;
  saving.value = true;
  try {
    await setAvailability(props.service.id, enabled.value ? items.value : []);
    emit('close');
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="service"
        class="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 backdrop-blur-sm p-4"
        role="dialog"
        aria-modal="true"
        @click.self="emit('close')"
      >
        <div class="bg-white rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-2xl border border-[var(--color-outline-variant)]/10">
          <!-- Header -->
          <div class="flex items-center justify-between p-6 pb-4 border-b border-[var(--color-outline-variant)]/10">
            <div>
              <h3 class="text-lg font-bold text-[var(--color-on-surface)]">Disponibilidad: {{ service.name }}</h3>
              <p class="text-xs text-[var(--color-on-surface-variant)] mt-0.5">Restringe en qué días y horarios se ofrece este servicio</p>
            </div>
            <button
              class="p-2 text-[var(--color-outline)] hover:text-[var(--color-on-surface)] rounded-lg hover:bg-[var(--color-surface-container-high)] transition-colors"
              aria-label="Cerrar"
              @click="emit('close')"
            >
              <span class="material-symbols-outlined" aria-hidden="true">close</span>
            </button>
          </div>

          <div v-if="pending" class="flex-1 flex items-center justify-center py-12" role="status">
            <div class="w-6 h-6 border-2 border-[var(--color-primary)]/30 border-t-[var(--color-primary)] rounded-full animate-spin" aria-hidden="true"></div>
            <span class="sr-only">Cargando disponibilidad…</span>
          </div>
          <div v-else class="flex-1 overflow-y-auto p-6 space-y-4">
            <!-- Toggle -->
            <div class="flex items-center justify-between p-4 rounded-xl bg-[var(--color-surface-container-low)] border border-[var(--color-outline-variant)]/10">
              <div>
                <p class="text-sm font-semibold text-[var(--color-on-surface)]">Restringir disponibilidad</p>
                <p class="text-xs text-[var(--color-on-surface-variant)]">
                  {{ enabled ? 'Solo disponible en los días/horarios configurados' : 'Disponible siempre que el empleado tenga horario' }}
                </p>
              </div>
              <button
                class="w-12 h-7 rounded-full transition-colors relative"
                :class="enabled ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-outline-variant)]/30'"
                role="switch"
                :aria-checked="enabled"
                aria-label="Restringir disponibilidad"
                @click="toggleEnabled"
              >
                <span
                  class="absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-transform"
                  :class="enabled ? 'translate-x-6' : 'translate-x-1'"
                ></span>
              </button>
            </div>

            <!-- Day list -->
            <div v-if="enabled" class="space-y-2">
              <div v-for="day in DAYS_ORDER" :key="day" class="flex items-center gap-3 p-3 rounded-lg border border-[var(--color-outline-variant)]/15">
                <button
                  class="w-5 h-5 rounded flex items-center justify-center border-2 transition-all shrink-0"
                  :class="isDayActive(day)
                    ? 'bg-[var(--color-primary)] border-[var(--color-primary)]'
                    : 'border-[var(--color-outline-variant)]/40 hover:border-[var(--color-primary)]/40'"
                  role="checkbox"
                  :aria-checked="isDayActive(day)"
                  :aria-label="`Disponible los ${DAY_LABELS[day]}`"
                  @click="toggleDay(day)"
                >
                  <span v-if="isDayActive(day)" class="material-symbols-outlined text-white text-sm" style="font-variation-settings: 'wght' 600" aria-hidden="true">check</span>
                </button>
                <span class="text-sm font-medium w-24 shrink-0" :class="isDayActive(day) ? 'text-[var(--color-on-surface)]' : 'text-[var(--color-outline)]'">
                  {{ DAY_LABELS[day] }}
                </span>
                <template v-if="isDayActive(day) && itemFor(day)">
                  <input
                    v-model="itemFor(day)!.startTime"
                    type="time"
                    :aria-label="`Inicio ${DAY_LABELS[day]}`"
                    class="flex-1 px-2 py-1.5 bg-[var(--color-surface-container-high)] border-none rounded text-sm focus:ring-2 focus:ring-[var(--color-primary)]/20 outline-none"
                  />
                  <span class="text-xs text-[var(--color-outline)]">a</span>
                  <input
                    v-model="itemFor(day)!.endTime"
                    type="time"
                    :aria-label="`Fin ${DAY_LABELS[day]}`"
                    class="flex-1 px-2 py-1.5 bg-[var(--color-surface-container-high)] border-none rounded text-sm focus:ring-2 focus:ring-[var(--color-primary)]/20 outline-none"
                  />
                </template>
                <span v-else class="text-xs text-[var(--color-outline)] ml-auto">No disponible</span>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div class="p-6 pt-4 border-t border-[var(--color-outline-variant)]/10 flex gap-3">
            <button
              :disabled="saving"
              class="flex-1 py-3 soul-gradient text-white font-bold rounded-lg hover:opacity-90 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
              @click="save"
            >
              <span v-if="saving" class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" aria-hidden="true"></span>
              {{ saving ? 'Guardando...' : 'Guardar' }}
            </button>
            <button
              class="px-5 py-3 text-sm font-semibold text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface-container-high)] rounded-lg transition-colors"
              @click="emit('close')"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
