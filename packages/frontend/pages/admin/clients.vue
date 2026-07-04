<script setup lang="ts">
definePageMeta({ layout: 'admin' });

const clients = useClients();

onMounted(() => void clients.load());
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <!-- Top bar -->
    <header class="flex flex-wrap items-center gap-3 md:gap-4 px-4 md:px-6 py-2 md:h-16 bg-white/80 backdrop-blur-md border-b border-[var(--color-outline-variant)]/10 sticky top-0 z-40 shrink-0">
      <h1 class="text-lg font-bold tracking-tight">Clientes</h1>
      <div class="flex-1"></div>
      <!-- Search -->
      <div class="relative w-full sm:w-72">
        <span class="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-[var(--color-outline)] text-lg" aria-hidden="true">search</span>
        <input
          v-model="clients.search.value"
          type="search"
          aria-label="Buscar clientes"
          placeholder="Buscar por nombre o teléfono..."
          class="w-full pl-10 pr-4 py-2 bg-[var(--color-surface-container-high)] border-none rounded-lg text-sm focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:bg-white transition-all outline-none"
        />
      </div>
    </header>

    <!-- Content -->
    <div class="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
      <div class="max-w-6xl mx-auto w-full">
        <!-- Breadcrumbs -->
        <nav class="flex items-center gap-2 text-sm text-[var(--color-on-surface-variant)] mb-6 font-medium" aria-label="Migas de pan">
          <NuxtLink to="/admin" class="hover:text-[var(--color-primary)] transition-colors">Panel</NuxtLink>
          <span class="material-symbols-outlined text-xs" aria-hidden="true">chevron_right</span>
          <span class="text-[var(--color-on-surface)]">Clientes</span>
        </nav>

        <!-- Header -->
        <div class="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div class="space-y-1">
            <h2 class="text-3xl lg:text-4xl font-extrabold tracking-tight text-[var(--color-on-surface)]">Clientes</h2>
            <p class="text-[var(--color-on-surface-variant)] max-w-xl">
              Directorio de todas las personas que han reservado contigo. Se actualiza automáticamente con cada cita.
            </p>
          </div>
        </div>

        <!-- Stats -->
        <div v-if="!clients.pending.value && clients.items.value.length > 0" class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          <div class="p-5 bg-white rounded-xl shadow-sm border border-[var(--color-outline-variant)]/10">
            <p class="text-[10px] font-bold uppercase tracking-widest text-[var(--color-outline)] mb-1">Total Clientes</p>
            <p class="text-3xl font-black text-[var(--color-on-surface)]">{{ clients.items.value.length }}</p>
          </div>
          <div class="p-5 bg-white rounded-xl shadow-sm border border-[var(--color-outline-variant)]/10">
            <p class="text-[10px] font-bold uppercase tracking-widest text-[var(--color-outline)] mb-1">Total Citas</p>
            <p class="text-3xl font-black text-[var(--color-primary)]">{{ clients.totalVisits.value }}</p>
          </div>
          <div class="p-5 bg-white rounded-xl shadow-sm border border-[var(--color-outline-variant)]/10">
            <p class="text-[10px] font-bold uppercase tracking-widest text-[var(--color-outline)] mb-1">Promedio Visitas</p>
            <p class="text-3xl font-black text-emerald-600">{{ clients.avgVisits.value }}</p>
          </div>
          <div class="p-5 bg-white rounded-xl shadow-sm border border-[var(--color-outline-variant)]/10">
            <p class="text-[10px] font-bold uppercase tracking-widest text-[var(--color-outline)] mb-1">Cliente Top</p>
            <p class="text-xl font-black text-[var(--color-on-surface)] truncate">{{ clients.topClient.value }}</p>
          </div>
        </div>

        <!-- Loading skeleton -->
        <div v-if="clients.pending.value" class="space-y-3" role="status" aria-label="Cargando clientes">
          <div
            v-for="i in 5"
            :key="i"
            class="flex items-center gap-4 p-5 bg-white rounded-xl shadow-sm border border-[var(--color-outline-variant)]/10 animate-pulse"
          >
            <div class="w-11 h-11 rounded-full bg-slate-100"></div>
            <div class="flex-1 space-y-2">
              <div class="h-4 w-36 bg-slate-100 rounded"></div>
              <div class="h-3 w-48 bg-slate-50 rounded"></div>
            </div>
            <div class="w-16 h-8 bg-slate-50 rounded"></div>
          </div>
        </div>

        <!-- Empty state -->
        <div v-else-if="clients.items.value.length === 0" class="flex flex-col items-center justify-center py-24 text-center space-y-6">
          <div class="w-32 h-32 bg-white rounded-full flex items-center justify-center shadow-sm border border-[var(--color-outline-variant)]/10">
            <span class="material-symbols-outlined text-6xl text-[var(--color-outline-variant)]" aria-hidden="true">person_search</span>
          </div>
          <div class="space-y-2">
            <h3 class="text-2xl font-bold text-[var(--color-on-surface)]">Aún no tienes clientes</h3>
            <p class="text-[var(--color-on-surface-variant)] max-w-sm mx-auto">
              Cuando alguien reserve una cita contigo, aparecerá aquí automáticamente.
            </p>
          </div>
        </div>

        <!-- No search results -->
        <div v-else-if="clients.filtered.value.length === 0 && clients.search.value" class="flex flex-col items-center justify-center py-16 text-center space-y-4">
          <span class="material-symbols-outlined text-5xl text-[var(--color-outline-variant)]" aria-hidden="true">search_off</span>
          <p class="text-[var(--color-on-surface-variant)]">No se encontraron clientes con "{{ clients.search.value }}"</p>
        </div>

        <!-- Client list -->
        <div v-else class="space-y-3">
          <ClientListItem
            v-for="(c, idx) in clients.filtered.value"
            :key="c.phone"
            :client="c"
            :index="idx"
          />
        </div>
      </div>
    </div>
  </div>
</template>
