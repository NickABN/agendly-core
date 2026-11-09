<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue';
import { usePublicDirectory } from '~/composables/usePublicDirectory';
import { getInitials } from '~/utils/initials';

useHead({ title: 'Negocios en Agendly' });
useSeoMeta({
  title: 'Negocios en Agendly',
  description: 'Encuentra negocios de belleza y bienestar que reservan con Agendly.',
});

const search = ref('');
const { businesses, loading, error, load } = usePublicDirectory();
let searchTimeout: ReturnType<typeof setTimeout> | undefined;

onMounted(() => {
  void load();
});

watch(search, (query) => {
  if (searchTimeout) clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => void load(query), 300);
});

onUnmounted(() => {
  if (searchTimeout) clearTimeout(searchTimeout);
});
</script>

<template>
  <main
    class="min-h-screen bg-[var(--color-surface)] px-4 py-10 text-[var(--color-on-surface)] sm:px-6"
  >
    <div class="mx-auto max-w-5xl space-y-8">
      <header class="space-y-3">
        <a href="/" class="text-sm font-semibold text-[var(--color-primary)] hover:underline">
          Agendly
        </a>
        <h1 class="text-3xl font-bold tracking-tight sm:text-4xl">Negocios en Agendly</h1>
      </header>

      <div class="max-w-xl space-y-2">
        <label for="directory-search" class="block text-sm font-medium">
          Buscar por nombre o zona
        </label>
        <input
          id="directory-search"
          v-model="search"
          type="search"
          maxlength="80"
          autocomplete="off"
          class="w-full rounded-xl border border-[var(--color-outline-variant)] bg-[var(--color-surface-container-lowest)] px-4 py-3 outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30"
          placeholder="Nombre o zona"
        />
      </div>

      <p
        v-if="loading"
        role="status"
        class="rounded-xl bg-[var(--color-surface-container-lowest)] p-6 text-[var(--color-on-surface-variant)]"
      >
        Cargando negocios…
      </p>
      <p
        v-else-if="error"
        role="alert"
        class="rounded-xl bg-[var(--color-surface-container-lowest)] p-6 text-[var(--color-error)]"
      >
        No pudimos cargar el directorio. Intenta de nuevo.
      </p>
      <p
        v-else-if="businesses.length === 0"
        class="rounded-xl bg-[var(--color-surface-container-lowest)] p-6 text-[var(--color-on-surface-variant)]"
      >
        {{
          search.trim()
            ? 'Aún no hay negocios con ese nombre.'
            : 'Aún no hay negocios en el directorio.'
        }}
      </p>
      <ul v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <li v-for="business in businesses" :key="business.slug">
          <NuxtLink
            :to="`/${business.slug}`"
            class="flex h-full items-center gap-4 rounded-xl border border-[var(--color-outline-variant)]/30 bg-[var(--color-surface-container-lowest)] p-4 transition hover:border-[var(--color-primary)]/40 hover:shadow-sm"
          >
            <img
              v-if="business.logoUrl"
              :src="business.logoUrl"
              :alt="`Logo de ${business.name}`"
              class="size-14 shrink-0 rounded-full object-cover"
            />
            <span
              v-else
              aria-hidden="true"
              class="flex size-14 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)]/10 font-bold text-[var(--color-primary)]"
            >
              {{ getInitials(business.name) }}
            </span>
            <span class="min-w-0 space-y-1">
              <span class="block truncate font-semibold">{{ business.name }}</span>
              <span
                v-if="business.address"
                class="block text-sm text-[var(--color-on-surface-variant)]"
              >
                {{ business.address }}
              </span>
            </span>
          </NuxtLink>
        </li>
      </ul>
    </div>
  </main>
</template>
