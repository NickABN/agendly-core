<script setup lang="ts">
import type { ScheduleBlock } from '~/composables/useSchedules';

const props = defineProps<{
  employee: { id: string; name: string } | null;
}>();

const emit = defineEmits<{
  close: [];
  saved: [];
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

const DEFAULT_WEEK: ScheduleBlock[] = DAYS_ORDER.filter((d) => d !== 'SUNDAY').map((d) => ({
  dayOfWeek: d,
  blockIndex: 0,
  startTime: '09:00',
  endTime: '19:00',
}));

const { blocks, pending, saving, loadForEmployee, bulkSave } = useSchedules();

watch(
  () => props.employee,
  (employee) => {
    if (employee) void loadForEmployee(employee.id, [...DEFAULT_WEEK]);
  },
  { immediate: true },
);

function blocksForDay(day: string) {
  return blocks.value.filter((b) => b.dayOfWeek === day).sort((a, b) => a.blockIndex - b.blockIndex);
}

function isDayActive(day: string) {
  return blocks.value.some((b) => b.dayOfWeek === day);
}

function toggleDay(day: string) {
  if (isDayActive(day)) {
    blocks.value = blocks.value.filter((b) => b.dayOfWeek !== day);
  } else {
    blocks.value.push({ dayOfWeek: day, blockIndex: 0, startTime: '09:00', endTime: '19:00' });
  }
}

function addBlock(day: string) {
  const existing = blocksForDay(day);
  if (existing.length >= 3) return;
  const lastBlock = existing[existing.length - 1];
  blocks.value.push({
    dayOfWeek: day,
    blockIndex: existing.length,
    startTime: lastBlock ? lastBlock.endTime : '14:00',
    endTime: '19:00',
  });
}

function removeBlock(day: string, blockIndex: number) {
  blocks.value = blocks.value.filter((b) => !(b.dayOfWeek === day && b.blockIndex === blockIndex));
  let idx = 0;
  for (const b of blocksForDay(day)) {
    b.blockIndex = idx++;
  }
}

async function save() {
  if (!props.employee) return;
  await bulkSave(props.employee.id);
  emit('saved');
  emit('close');
}
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="employee"
        class="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 backdrop-blur-sm p-4"
        role="dialog"
        aria-modal="true"
        @click.self="emit('close')"
      >
        <div class="bg-white rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-2xl border border-[var(--color-outline-variant)]/10">
          <!-- Header -->
          <div class="flex items-center justify-between p-6 pb-4 border-b border-[var(--color-outline-variant)]/10">
            <div>
              <h3 class="text-lg font-bold text-[var(--color-on-surface)]">Horario de {{ employee.name }}</h3>
              <p class="text-xs text-[var(--color-on-surface-variant)] mt-0.5">Configura los bloques de horario por día</p>
            </div>
            <button
              class="p-2 text-[var(--color-outline)] hover:text-[var(--color-on-surface)] rounded-lg hover:bg-[var(--color-surface-container-high)] transition-colors"
              aria-label="Cerrar"
              @click="emit('close')"
            >
              <span class="material-symbols-outlined" aria-hidden="true">close</span>
            </button>
          </div>

          <!-- Days list -->
          <div v-if="pending" class="flex-1 flex items-center justify-center py-12" role="status">
            <div class="w-6 h-6 border-2 border-[var(--color-primary)]/30 border-t-[var(--color-primary)] rounded-full animate-spin" aria-hidden="true"></div>
            <span class="sr-only">Cargando horario…</span>
          </div>
          <div v-else class="flex-1 overflow-y-auto p-6 space-y-3">
            <div v-for="day in DAYS_ORDER" :key="day" class="rounded-xl border border-[var(--color-outline-variant)]/15 overflow-hidden">
              <!-- Day header -->
              <div class="flex items-center gap-3 px-4 py-3 bg-[var(--color-surface-container-low)]">
                <button
                  class="w-5 h-5 rounded flex items-center justify-center border-2 transition-all shrink-0"
                  :class="isDayActive(day)
                    ? 'bg-[var(--color-primary)] border-[var(--color-primary)]'
                    : 'border-[var(--color-outline-variant)]/40 hover:border-[var(--color-primary)]/40'"
                  role="checkbox"
                  :aria-checked="isDayActive(day)"
                  :aria-label="`Trabaja los ${DAY_LABELS[day]}`"
                  @click="toggleDay(day)"
                >
                  <span v-if="isDayActive(day)" class="material-symbols-outlined text-white text-sm" style="font-variation-settings: 'wght' 600" aria-hidden="true">check</span>
                </button>
                <span class="text-sm font-semibold" :class="isDayActive(day) ? 'text-[var(--color-on-surface)]' : 'text-[var(--color-outline)]'">
                  {{ DAY_LABELS[day] }}
                </span>
                <span v-if="!isDayActive(day)" class="text-xs text-[var(--color-outline)] ml-auto">Descanso</span>
                <button
                  v-if="isDayActive(day) && blocksForDay(day).length < 3"
                  class="ml-auto p-1 text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 rounded transition-colors"
                  :aria-label="`Agregar bloque el ${DAY_LABELS[day]}`"
                  @click="addBlock(day)"
                >
                  <span class="material-symbols-outlined text-sm" aria-hidden="true">add</span>
                </button>
              </div>

              <!-- Time blocks -->
              <div v-if="isDayActive(day)" class="px-4 py-3 space-y-2">
                <div v-for="block in blocksForDay(day)" :key="block.blockIndex" class="flex items-center gap-2">
                  <input
                    v-model="block.startTime"
                    type="time"
                    :aria-label="`Inicio ${DAY_LABELS[day]}`"
                    class="flex-1 px-3 py-2 bg-[var(--color-surface-container-high)] border-none rounded-lg text-sm focus:ring-2 focus:ring-[var(--color-primary)]/20 outline-none"
                  />
                  <span class="text-xs text-[var(--color-outline)] font-medium">a</span>
                  <input
                    v-model="block.endTime"
                    type="time"
                    :aria-label="`Fin ${DAY_LABELS[day]}`"
                    class="flex-1 px-3 py-2 bg-[var(--color-surface-container-high)] border-none rounded-lg text-sm focus:ring-2 focus:ring-[var(--color-primary)]/20 outline-none"
                  />
                  <button
                    v-if="blocksForDay(day).length > 1"
                    class="p-1 text-red-400 hover:bg-red-50 rounded transition-colors"
                    :aria-label="`Quitar bloque del ${DAY_LABELS[day]}`"
                    @click="removeBlock(day, block.blockIndex)"
                  >
                    <span class="material-symbols-outlined text-sm" aria-hidden="true">close</span>
                  </button>
                </div>
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
              {{ saving ? 'Guardando...' : 'Guardar horario' }}
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
