<script setup lang="ts">
import * as Sentry from '@sentry/vue';
import type { NuxtError } from '#app';

const props = defineProps<{ error: NuxtError }>();

// Reportar solo errores de servidor (5xx / inesperados) a Sentry.
if (import.meta.client && (!props.error.statusCode || props.error.statusCode >= 500)) {
  Sentry.captureException(props.error);
}

const is404 = computed(() => props.error?.statusCode === 404);
// Backend asleep on the free hosting plan (502/503/504 from the proxy, timeouts).
const isColdStart = computed(() => !is404.value && isColdStartError(props.error));

function goHome() {
  clearError({ redirect: '/' });
}

function retry() {
  window.location.reload();
}
</script>

<template>
  <div
    class="min-h-screen flex flex-col items-center justify-center px-6 text-center bg-[var(--color-surface)]"
  >
    <span
      class="material-symbols-outlined text-6xl text-[var(--color-outline-variant)] mb-4"
      aria-hidden="true"
    >
      {{ is404 ? 'search_off' : isColdStart ? 'cloud_sync' : 'error_outline' }}
    </span>
    <template v-if="isColdStart">
      <h1 class="text-2xl font-bold text-[var(--color-on-surface)] mb-2">
        Estamos despertando el servidor
      </h1>
      <p class="text-sm text-[var(--color-on-surface-variant)] max-w-sm mb-2">
        Agendly usa por ahora un plan gratuito de hosting (Render) que pone el servidor en pausa
        cuando no hay actividad. Al recibir la primera solicitud se reactiva y puede tardar hasta un
        minuto.
      </p>
      <p class="text-sm text-[var(--color-on-surface-variant)] max-w-sm mb-6">
        Es un tema de infraestructura, no una falla de la app. Espera unos segundos y vuelve a
        intentarlo.
      </p>
      <button
        class="bg-[var(--color-primary)] text-white px-6 py-3 rounded-lg font-semibold hover:opacity-90 transition-all mb-3"
        @click="retry"
      >
        Reintentar
      </button>
    </template>
    <template v-else>
      <h1 class="text-2xl font-bold text-[var(--color-on-surface)] mb-2">
        {{ is404 ? 'Página no encontrada' : 'Algo salió mal' }}
      </h1>
      <p class="text-sm text-[var(--color-on-surface-variant)] max-w-sm mb-6">
        {{
          is404
            ? 'La página que buscas no existe o fue movida.'
            : 'Ocurrió un error inesperado. Ya lo registramos; intenta de nuevo en un momento.'
        }}
      </p>
    </template>
    <button
      class="bg-[var(--color-primary)] text-white px-6 py-3 rounded-lg font-semibold hover:opacity-90 transition-all"
      @click="goHome"
    >
      Volver al inicio
    </button>
  </div>
</template>
