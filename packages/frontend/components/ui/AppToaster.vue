<script setup lang="ts">
const { toasts, remove } = useAppToast();
</script>

<template>
  <div
    class="fixed inset-x-4 bottom-4 z-[60] mx-auto flex max-w-sm flex-col gap-2 sm:inset-x-auto sm:right-4 sm:mx-0 sm:w-96"
    aria-live="polite"
  >
    <div
      v-for="toast in toasts"
      :key="toast.id"
      class="flex items-center gap-3 rounded-xl border p-4 shadow-lg"
      :class="
        toast.kind === 'success'
          ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
          : 'border-red-200 bg-red-50 text-red-800'
      "
      :role="toast.kind === 'error' ? 'alert' : undefined"
    >
      <span class="material-symbols-outlined shrink-0" aria-hidden="true">
        {{ toast.kind === 'success' ? 'check_circle' : 'error' }}
      </span>
      <p class="min-w-0 flex-1 text-sm font-medium">{{ toast.message }}</p>
      <button
        type="button"
        aria-label="Cerrar aviso"
        class="shrink-0 rounded-md p-1 text-current/70 hover:bg-black/5 hover:text-current"
        @click="remove(toast.id)"
      >
        <span class="material-symbols-outlined text-lg" aria-hidden="true">close</span>
      </button>
    </div>
  </div>
</template>
