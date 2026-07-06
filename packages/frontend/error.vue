<script setup lang="ts">
import * as Sentry from '@sentry/vue';
import type { NuxtError } from '#app';

const props = defineProps<{ error: NuxtError }>();

// Reportar solo errores de servidor (5xx / inesperados) a Sentry.
if (import.meta.client && (!props.error.statusCode || props.error.statusCode >= 500)) {
  Sentry.captureException(props.error);
}

const is404 = computed(() => props.error?.statusCode === 404);

function goHome() {
  clearError({ redirect: '/' });
}
</script>

<template>
  <div class="min-h-screen flex flex-col items-center justify-center px-6 text-center bg-[var(--color-surface)]">
    <span class="material-symbols-outlined text-6xl text-[var(--color-outline-variant)] mb-4" aria-hidden="true">
      {{ is404 ? 'search_off' : 'error_outline' }}
    </span>
    <h1 class="text-2xl font-bold text-[var(--color-on-surface)] mb-2">
      {{ is404 ? 'Página no encontrada' : 'Algo salió mal' }}
    </h1>
    <p class="text-sm text-[var(--color-on-surface-variant)] max-w-sm mb-6">
      {{ is404
        ? 'La página que buscas no existe o fue movida.'
        : 'Ocurrió un error inesperado. Ya lo registramos; intenta de nuevo en un momento.' }}
    </p>
    <button
      class="bg-[var(--color-primary)] text-white px-6 py-3 rounded-lg font-semibold hover:opacity-90 transition-all"
      @click="goHome"
    >
      Volver al inicio
    </button>
  </div>
</template>
