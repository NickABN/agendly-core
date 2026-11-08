<script setup lang="ts">
import {
  areScheduleBlocksValid,
  createInitialScheduleBlocks,
  expandScheduleBlocks,
  ONBOARDING_WEEK_DAYS,
  validateScheduleBlock,
  type OnboardingScheduleBlock,
  type ScheduleChange,
} from '~/utils/onboardingSchedule';

const emit = defineEmits<{
  (event: 'schedule-change', change: ScheduleChange): void;
}>();

const scheduleBlocks = ref<OnboardingScheduleBlock[]>(createInitialScheduleBlocks());
const nextBlockId = ref(2);

const blockValidations = computed(() => scheduleBlocks.value.map(validateScheduleBlock));
const scheduleIsValid = computed(() => areScheduleBlocksValid(scheduleBlocks.value));
const blocksWithDisabledDays = computed(() =>
  scheduleBlocks.value.map((block, blockIndex) => ({
    ...block,
    disabledDays: scheduleBlocks.value
      .filter((_, otherIndex) => otherIndex !== blockIndex)
      .flatMap((otherBlock) => otherBlock.days),
  })),
);
const closedDays = computed(() =>
  ONBOARDING_WEEK_DAYS.filter(
    (_, dayIndex) => !scheduleBlocks.value.some((block) => block.days.includes(dayIndex)),
  ).map((day) => day.name),
);

function emitScheduleChange() {
  emit('schedule-change', {
    weekDays: expandScheduleBlocks(scheduleBlocks.value),
    valid: scheduleIsValid.value,
  });
}

function toggleDay(blockIndex: number, dayIndex: number) {
  const block = scheduleBlocks.value[blockIndex];
  if (!block || blocksWithDisabledDays.value[blockIndex]?.disabledDays.includes(dayIndex)) {
    return;
  }

  const selectedDayIndex = block.days.indexOf(dayIndex);
  if (selectedDayIndex >= 0) {
    block.days.splice(selectedDayIndex, 1);
  } else {
    block.days.push(dayIndex);
  }

  emitScheduleChange();
}

function updateTime(blockIndex: number, field: 'start' | 'end', event: Event) {
  const block = scheduleBlocks.value[blockIndex];
  if (!block) return;

  block[field] = (event.target as HTMLInputElement).value;
  emitScheduleChange();
}

function addBlock() {
  scheduleBlocks.value.push({
    id: nextBlockId.value++,
    days: [],
    start: '09:00',
    end: '19:00',
  });
  emitScheduleChange();
}

function removeBlock(blockIndex: number) {
  scheduleBlocks.value.splice(blockIndex, 1);
  emitScheduleChange();
}
</script>

<template>
  <div class="space-y-4">
    <section
      v-for="(block, blockIndex) in blocksWithDisabledDays"
      :key="block.id"
      class="space-y-4 rounded-xl border border-[var(--color-outline-variant)]/20 bg-[var(--color-surface-container-low)] p-4 md:p-5"
      :aria-label="`Bloque de horario ${blockIndex + 1}`"
    >
      <div class="flex items-center justify-between gap-3">
        <h2 class="text-sm font-semibold">Bloque {{ blockIndex + 1 }}</h2>
        <button
          type="button"
          class="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm text-red-600 transition-colors hover:bg-red-50"
          :aria-label="`Eliminar bloque ${blockIndex + 1}`"
          @click="removeBlock(blockIndex)"
        >
          <span class="material-symbols-outlined text-base" aria-hidden="true">delete</span>
          <span>Eliminar</span>
        </button>
      </div>

      <div class="flex flex-wrap gap-2" :aria-label="`Días del bloque ${blockIndex + 1}`">
        <button
          v-for="(day, dayIndex) in ONBOARDING_WEEK_DAYS"
          :key="day.name"
          type="button"
          class="flex h-10 w-10 items-center justify-center rounded-full border text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-35"
          :class="
            block.days.includes(dayIndex)
              ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-white'
              : 'border-[var(--color-outline-variant)]/40 bg-white text-[var(--color-on-surface-variant)] hover:border-[var(--color-primary)]'
          "
          :aria-label="
            block.disabledDays.includes(dayIndex)
              ? `${day.name}, asignado a otro bloque`
              : `${day.name}, ${block.days.includes(dayIndex) ? 'seleccionado' : 'no seleccionado'}`
          "
          :aria-pressed="block.days.includes(dayIndex)"
          :disabled="block.disabledDays.includes(dayIndex)"
          @click="toggleDay(blockIndex, dayIndex)"
        >
          {{ day.shortName }}
        </button>
      </div>

      <div class="grid grid-cols-2 gap-3">
        <div class="space-y-2">
          <label
            class="text-xs font-medium uppercase tracking-wide text-[var(--color-on-surface-variant)]"
            :for="`schedule-start-${block.id}`"
          >
            Abre
          </label>
          <input
            :id="`schedule-start-${block.id}`"
            :value="block.start"
            type="time"
            class="w-full rounded-lg border border-[var(--color-outline-variant)]/30 bg-white px-3 py-3 text-sm focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20"
            @input="updateTime(blockIndex, 'start', $event)"
          />
        </div>
        <div class="space-y-2">
          <label
            class="text-xs font-medium uppercase tracking-wide text-[var(--color-on-surface-variant)]"
            :for="`schedule-end-${block.id}`"
          >
            Cierra
          </label>
          <input
            :id="`schedule-end-${block.id}`"
            :value="block.end"
            type="time"
            class="w-full rounded-lg border border-[var(--color-outline-variant)]/30 bg-white px-3 py-3 text-sm focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20"
            @input="updateTime(blockIndex, 'end', $event)"
          />
        </div>
      </div>

      <p v-if="!blockValidations[blockIndex]?.hasDays" class="text-sm text-red-700" role="alert">
        Selecciona al menos un día para este bloque.
      </p>
      <p v-if="!blockValidations[blockIndex]?.validTime" class="text-sm text-red-700" role="alert">
        La hora de apertura debe ser anterior a la hora de cierre.
      </p>
    </section>

    <button
      type="button"
      class="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[var(--color-outline-variant)]/40 py-3 font-medium text-[var(--color-primary)] transition-colors hover:border-[var(--color-primary)]/40 hover:bg-[var(--color-primary)]/5"
      @click="addBlock"
    >
      <span class="material-symbols-outlined" aria-hidden="true">add_circle</span>
      Agregar bloque
    </button>

    <p
      class="rounded-lg bg-[var(--color-surface-container-low)] px-4 py-3 text-sm text-[var(--color-on-surface-variant)]"
    >
      <span class="font-semibold text-[var(--color-on-surface)]">Cerrado:</span>
      {{ closedDays.length ? closedDays.join(', ') : 'ningún día' }}
    </p>
  </div>
</template>
