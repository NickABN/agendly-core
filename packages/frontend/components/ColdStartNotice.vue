<script setup lang="ts">
/**
 * Transparent notice shown while the backend (Render free plan) wakes up.
 * State comes from useColdStartNotice(), driven by plugins/cold-start.client.ts.
 */
const { phase, dismiss } = useColdStartNotice();

const content = computed(() => {
  switch (phase.value) {
    case 'waking':
      return {
        icon: 'hourglass_top',
        title: 'Despertando el servidor…',
        detail: 'Reintentamos automáticamente; no necesitas hacer nada.',
      };
    case 'failed-read':
      return {
        icon: 'cloud_sync',
        title: 'El servidor sigue despertando',
        detail: 'Espera unos segundos y vuelve a intentarlo.',
      };
    case 'failed-write':
      return {
        icon: 'cloud_sync',
        title: 'Tu acción no se confirmó',
        detail:
          'El servidor estaba despertando. Revisa la información y vuelve a intentarlo en unos segundos.',
      };
    default:
      return null;
  }
});

function retry() {
  dismiss();
  window.location.reload();
}
</script>

<template>
  <div
    v-if="content"
    class="fixed inset-x-0 bottom-0 z-[100] p-4 sm:bottom-4 sm:left-auto sm:right-4 sm:max-w-sm sm:p-0"
    role="status"
    aria-live="polite"
  >
    <div
      class="rounded-xl border border-[var(--color-outline-variant)]/40 bg-[var(--color-surface-container-lowest,#fff)] p-4 shadow-xl"
    >
      <div class="flex items-start gap-3">
        <span
          class="material-symbols-outlined text-2xl text-[var(--color-primary)]"
          :class="{ 'animate-pulse': phase === 'waking' }"
          aria-hidden="true"
          >{{ content.icon }}</span
        >
        <div class="min-w-0 flex-1 space-y-1">
          <p class="font-semibold text-[var(--color-on-surface)]">{{ content.title }}</p>
          <p class="text-sm text-[var(--color-on-surface-variant)]">
            Agendly usa por ahora un plan gratuito de hosting (Render) que pone el servidor en pausa
            cuando no hay actividad. Al recibir la primera solicitud se reactiva y puede tardar
            hasta un minuto. Es un tema de infraestructura, no una falla de la app.
          </p>
          <p class="text-sm text-[var(--color-on-surface-variant)]">{{ content.detail }}</p>
        </div>
        <button
          v-if="phase !== 'waking'"
          type="button"
          class="text-[var(--color-outline)] hover:text-[var(--color-on-surface-variant)]"
          aria-label="Cerrar aviso"
          @click="dismiss"
        >
          <span class="material-symbols-outlined text-lg" aria-hidden="true">close</span>
        </button>
      </div>
      <div v-if="phase !== 'waking'" class="mt-3 flex justify-end gap-2">
        <button
          v-if="phase === 'failed-read'"
          type="button"
          class="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
          @click="retry"
        >
          Reintentar
        </button>
        <button
          v-else
          type="button"
          class="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
          @click="dismiss"
        >
          Entendido
        </button>
      </div>
    </div>
  </div>
</template>
