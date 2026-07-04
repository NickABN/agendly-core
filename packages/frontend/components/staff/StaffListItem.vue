<script setup lang="ts">
import type { EmployeeItem } from '~/composables/useEmployees';

defineProps<{
  employee: EmployeeItem;
  index: number;
  serviceNames: string;
}>();

const emit = defineEmits<{
  edit: [];
  remove: [];
  schedule: [];
}>();

const ringColors = [
  'ring-blue-200',
  'ring-emerald-200',
  'ring-amber-200',
  'ring-violet-200',
  'ring-pink-200',
  'ring-teal-200',
];
</script>

<template>
  <div
    class="group flex items-center gap-4 md:gap-5 p-4 md:p-5 bg-white rounded-xl shadow-sm border border-[var(--color-outline-variant)]/10 transition-all duration-200 hover:shadow-md hover:border-[var(--color-primary)]/20"
  >
    <!-- Avatar -->
    <div
      class="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0 ring-2 ring-offset-2"
      :class="[colorForIndex(index), ringColors[index % ringColors.length]]"
    >
      {{ getInitials(employee.name) }}
    </div>

    <!-- Info -->
    <div class="flex-1 min-w-0">
      <div class="flex items-center gap-3 mb-1">
        <h3 class="font-bold text-[var(--color-on-surface)] truncate">{{ employee.name }}</h3>
        <span
          class="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full shrink-0"
          :class="
            employee.isActive
              ? 'text-emerald-700 bg-emerald-50 border border-emerald-100'
              : 'text-slate-500 bg-slate-50 border border-slate-200'
          "
        >
          {{ employee.isActive ? 'Activo' : 'Inactivo' }}
        </span>
      </div>
      <p v-if="employee.serviceIds.length > 0" class="text-sm text-[var(--color-on-surface-variant)] truncate">
        <span class="material-symbols-outlined text-sm align-middle mr-1" aria-hidden="true">content_cut</span>
        {{ serviceNames }}
      </p>
      <p v-else class="text-sm text-[var(--color-outline)] italic">Sin servicios asignados</p>
    </div>

    <!-- Actions (always visible on touch, hover-reveal on desktop) -->
    <div class="flex items-center gap-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity shrink-0">
      <button
        class="p-2 text-[var(--color-outline)] hover:bg-[var(--color-surface-container-high)] rounded-full transition-colors"
        :aria-label="`Horario de ${employee.name}`"
        @click="emit('schedule')"
      >
        <span class="material-symbols-outlined text-lg" aria-hidden="true">schedule</span>
      </button>
      <button
        class="p-2 text-[var(--color-outline)] hover:bg-[var(--color-surface-container-high)] rounded-full transition-colors"
        :aria-label="`Editar a ${employee.name}`"
        @click="emit('edit')"
      >
        <span class="material-symbols-outlined text-lg" aria-hidden="true">edit</span>
      </button>
      <button
        class="p-2 text-red-400 hover:bg-red-50 rounded-full transition-colors"
        :aria-label="`Eliminar a ${employee.name}`"
        @click="emit('remove')"
      >
        <span class="material-symbols-outlined text-lg" aria-hidden="true">delete</span>
      </button>
    </div>
  </div>
</template>
