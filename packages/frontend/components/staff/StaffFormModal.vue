<script setup lang="ts">
import type { EmployeeItem } from '~/composables/useEmployees';
import type { ServiceItem } from '~/composables/useServices';

const props = defineProps<{
  open: boolean;
  services: ServiceItem[];
  editing: EmployeeItem | null;
}>();

const emit = defineEmits<{
  'update:open': [open: boolean];
  submit: [data: { name: string; serviceIds: string[] }];
}>();

const form = reactive({
  name: '',
  serviceIds: [] as string[],
});

watch(
  () => props.open,
  (open) => {
    if (open) {
      form.name = props.editing?.name ?? '';
      form.serviceIds = props.editing ? [...props.editing.serviceIds] : [];
    }
  },
);

function toggleService(id: string) {
  const idx = form.serviceIds.indexOf(id);
  if (idx >= 0) form.serviceIds.splice(idx, 1);
  else form.serviceIds.push(id);
}

function close() {
  emit('update:open', false);
}

function submit() {
  if (!form.name) return;
  emit('submit', { name: form.name, serviceIds: [...form.serviceIds] });
}
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="open"
        class="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 backdrop-blur-sm p-6"
        role="dialog"
        aria-modal="true"
        @click.self="close"
      >
        <div class="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl border border-[var(--color-outline-variant)]/10">
          <div class="flex items-center justify-between mb-6">
            <h3 class="text-xl font-bold text-[var(--color-on-surface)]">
              {{ editing ? 'Editar Colaborador' : 'Nuevo Colaborador' }}
            </h3>
            <button
              class="p-2 text-[var(--color-outline)] hover:text-[var(--color-on-surface)] transition-colors rounded-lg hover:bg-[var(--color-surface-container-high)]"
              aria-label="Cerrar"
              @click="close"
            >
              <span class="material-symbols-outlined" aria-hidden="true">close</span>
            </button>
          </div>

          <form class="space-y-5" @submit.prevent="submit">
            <div class="space-y-2">
              <label for="staff-name" class="text-xs font-bold text-[var(--color-outline)] uppercase tracking-wider">
                Nombre completo
              </label>
              <input
                id="staff-name"
                v-model="form.name"
                type="text"
                required
                placeholder="Ej: María González"
                class="w-full px-4 py-3 bg-[var(--color-surface-container-high)] border-none rounded-lg focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:bg-white transition-all outline-none"
              />
            </div>

            <!-- Service assignment -->
            <div v-if="services.length > 0" class="space-y-2">
              <p class="text-xs font-bold text-[var(--color-outline)] uppercase tracking-wider">
                Servicios que ofrece
              </p>
              <div class="flex flex-wrap gap-2">
                <button
                  v-for="svc in services"
                  :key="svc.id"
                  type="button"
                  class="px-3 py-1.5 rounded-lg text-sm font-medium border transition-all"
                  :class="
                    form.serviceIds.includes(svc.id)
                      ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]'
                      : 'bg-white text-[var(--color-on-surface-variant)] border-[var(--color-outline-variant)]/30 hover:border-[var(--color-primary)]/40'
                  "
                  :aria-pressed="form.serviceIds.includes(svc.id)"
                  @click="toggleService(svc.id)"
                >
                  {{ svc.name }}
                </button>
              </div>
              <p class="text-xs text-[var(--color-on-surface-variant)]">
                Selecciona los servicios que este colaborador puede realizar
              </p>
            </div>

            <div class="flex gap-3 pt-2">
              <button
                type="submit"
                class="flex-1 py-3 soul-gradient text-white font-bold rounded-lg hover:opacity-90 transition-all active:scale-[0.98]"
              >
                {{ editing ? 'Guardar cambios' : 'Agregar colaborador' }}
              </button>
              <button
                type="button"
                class="px-5 py-3 text-sm font-semibold text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface-container-high)] rounded-lg transition-colors"
                @click="close"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
