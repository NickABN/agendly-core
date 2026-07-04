<script setup lang="ts">
import type { ServiceItem } from '~/composables/useServices';

const props = defineProps<{
  open: boolean;
  editing: ServiceItem | null;
}>();

const emit = defineEmits<{
  'update:open': [open: boolean];
  submit: [data: { name: string; durationMinutes: number; priceMXN: number }];
}>();

const form = reactive({
  name: '',
  durationMinutes: 30,
  priceMXN: 0,
});

watch(
  () => props.open,
  (open) => {
    if (open) {
      form.name = props.editing?.name ?? '';
      form.durationMinutes = props.editing?.durationMinutes ?? 30;
      form.priceMXN = props.editing ? Number(props.editing.priceMXN) : 0;
    }
  },
);

function close() {
  emit('update:open', false);
}

function submit() {
  if (!form.name) return;
  emit('submit', { ...form });
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
              {{ editing ? 'Editar Servicio' : 'Nuevo Servicio' }}
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
              <label for="service-name" class="text-xs font-bold text-[var(--color-outline)] uppercase tracking-wider">
                Nombre del servicio
              </label>
              <input
                id="service-name"
                v-model="form.name"
                type="text"
                required
                placeholder="Ej: Corte de cabello"
                class="w-full px-4 py-3 bg-[var(--color-surface-container-high)] border-none rounded-lg focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:bg-white transition-all outline-none"
              />
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div class="space-y-2">
                <label for="service-duration" class="text-xs font-bold text-[var(--color-outline)] uppercase tracking-wider">
                  Duración
                </label>
                <select
                  id="service-duration"
                  v-model.number="form.durationMinutes"
                  class="w-full px-4 py-3 bg-[var(--color-surface-container-high)] border-none rounded-lg focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:bg-white transition-all outline-none appearance-none"
                >
                  <option :value="15">15 min</option>
                  <option :value="30">30 min</option>
                  <option :value="45">45 min</option>
                  <option :value="60">60 min</option>
                  <option :value="90">90 min</option>
                  <option :value="120">2 horas</option>
                </select>
              </div>
              <div class="space-y-2">
                <label for="service-price" class="text-xs font-bold text-[var(--color-outline)] uppercase tracking-wider">
                  Precio (MXN)
                </label>
                <div class="relative">
                  <span class="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-on-surface-variant)] font-semibold" aria-hidden="true">$</span>
                  <input
                    id="service-price"
                    v-model.number="form.priceMXN"
                    type="number"
                    min="0"
                    placeholder="0"
                    class="w-full pl-8 pr-4 py-3 bg-[var(--color-surface-container-high)] border-none rounded-lg focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:bg-white transition-all outline-none"
                  />
                </div>
              </div>
            </div>

            <div class="flex gap-3 pt-2">
              <button
                type="submit"
                class="flex-1 py-3 soul-gradient text-white font-bold rounded-lg hover:opacity-90 transition-all active:scale-[0.98]"
              >
                {{ editing ? 'Guardar cambios' : 'Agregar servicio' }}
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
