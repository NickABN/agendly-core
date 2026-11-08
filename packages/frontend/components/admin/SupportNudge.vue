<script setup lang="ts">
/**
 * Dismissible notice inviting owners to support Agendly while it is free.
 * Only shown when billing is NOT enforced. The dismissal persists per browser
 * in localStorage and is read client-side after mount to avoid SSR mismatch.
 */
const DISMISS_KEY = 'agendly:support-nudge-dismissed';

const { store } = useAuth();

const mounted = ref(false);
const dismissed = ref(false);

const visible = computed(() => mounted.value && !store.billingEnforced && !dismissed.value);

onMounted(() => {
  try {
    dismissed.value = localStorage.getItem(DISMISS_KEY) !== null;
  } catch {
    // localStorage may be unavailable (private mode, blocked storage); show the notice.
    dismissed.value = false;
  }
  mounted.value = true;
});

function dismiss() {
  dismissed.value = true;
  try {
    localStorage.setItem(DISMISS_KEY, '1');
  } catch {
    // Persisting the dismissal is best-effort; ignore storage failures.
  }
}
</script>

<template>
  <div
    v-if="visible"
    class="mb-4 flex items-center gap-3 rounded-xl border border-[var(--color-outline-variant)]/40 bg-[var(--color-surface-container-lowest,#fff)] p-3 md:p-4"
  >
    <span
      class="material-symbols-outlined text-[var(--color-primary)]"
      style="font-variation-settings: 'FILL' 1"
      aria-hidden="true"
      >volunteer_activism</span
    >
    <p class="min-w-0 flex-1 text-sm text-[var(--color-on-surface-variant)]">
      Si te gusta Agendly, apóyanos para mejorarlo.
      <NuxtLink
        to="/admin/subscription"
        class="font-semibold text-[var(--color-primary)] hover:underline"
      >
        Apoyar
      </NuxtLink>
    </p>
    <button
      type="button"
      class="shrink-0 text-[var(--color-outline)] hover:text-[var(--color-on-surface-variant)]"
      aria-label="Cerrar aviso"
      @click="dismiss"
    >
      <span class="material-symbols-outlined text-lg" aria-hidden="true">close</span>
    </button>
  </div>
</template>
