<script setup lang="ts">
import type { ServiceItem } from '~/composables/useServices';

definePageMeta({ layout: 'admin' });

const servicesStore = useServices();
const services = servicesStore.items;
const loading = servicesStore.pending;

const showForm = ref(false);
const editing = ref<ServiceItem | null>(null);
const availabilityService = ref<ServiceItem | null>(null);

// Stats
const activeCount = computed(() => services.value.filter((s) => s.isActive).length);
const avgDuration = computed(() => {
  if (!services.value.length) return 0;
  return Math.round(services.value.reduce((a, s) => a + s.durationMinutes, 0) / services.value.length);
});
const avgPrice = computed(() => {
  if (!services.value.length) return 0;
  return Math.round(services.value.reduce((a, s) => a + Number(s.priceMXN), 0) / services.value.length);
});

function openCreate() {
  editing.value = null;
  showForm.value = true;
}

function openEdit(service: ServiceItem) {
  editing.value = service;
  showForm.value = true;
}

async function onSubmit(data: { name: string; durationMinutes: number; priceMXN: number }) {
  if (editing.value) {
    await servicesStore.update(editing.value.id, data);
  } else {
    await servicesStore.create(data);
  }
  showForm.value = false;
  editing.value = null;
}

onMounted(() => void servicesStore.load());
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <!-- Top bar -->
    <header class="flex items-center gap-4 px-4 md:px-6 h-16 bg-white/80 backdrop-blur-md border-b border-[var(--color-outline-variant)]/10 sticky top-0 z-40 shrink-0">
      <h1 class="text-lg font-bold tracking-tight">Servicios</h1>
    </header>

    <!-- Content -->
    <div class="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
      <div class="max-w-7xl mx-auto w-full">
        <!-- Breadcrumbs -->
        <nav class="flex items-center gap-2 text-sm text-[var(--color-on-surface-variant)] mb-6 font-medium" aria-label="Migas de pan">
          <NuxtLink to="/admin" class="hover:text-[var(--color-primary)] transition-colors">Panel</NuxtLink>
          <span class="material-symbols-outlined text-xs" aria-hidden="true">chevron_right</span>
          <span class="text-[var(--color-on-surface)]">Servicios</span>
        </nav>

        <!-- Header -->
        <div class="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div class="space-y-1">
            <h2 class="text-3xl lg:text-4xl font-extrabold tracking-tight text-[var(--color-on-surface)]">Servicios</h2>
            <p class="text-[var(--color-on-surface-variant)] max-w-xl">
              Gestiona el catálogo de servicios de tu negocio, establece duraciones y precios personalizados para tus clientes.
            </p>
          </div>
          <button
            class="inline-flex items-center justify-center gap-2 soul-gradient text-white px-6 py-3 rounded-lg font-bold shadow-sm hover:opacity-90 transition-all active:scale-95 shrink-0"
            @click="openCreate"
          >
            <span class="material-symbols-outlined text-lg" aria-hidden="true">add_circle</span>
            Nuevo Servicio
          </button>
        </div>

        <ServiceFormModal v-model:open="showForm" :editing="editing" @submit="onSubmit" />
        <ServiceAvailabilityModal :service="availabilityService" @close="availabilityService = null" />

        <!-- Loading skeleton -->
        <div v-if="loading && services.length === 0" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" role="status" aria-label="Cargando servicios">
          <div v-for="i in 3" :key="i" class="bg-white rounded-xl p-6 shadow-sm border border-[var(--color-outline-variant)]/10 animate-pulse">
            <div class="flex justify-between mb-4">
              <div class="w-11 h-11 rounded-lg bg-slate-100"></div>
              <div class="w-14 h-5 rounded-full bg-slate-100"></div>
            </div>
            <div class="h-5 w-32 bg-slate-100 rounded mb-3"></div>
            <div class="h-4 w-full bg-slate-50 rounded mb-4"></div>
            <div class="border-t border-slate-50 pt-4 flex justify-between">
              <div class="w-16 h-4 bg-slate-100 rounded"></div>
              <div class="w-12 h-6 bg-slate-100 rounded"></div>
            </div>
          </div>
        </div>

        <!-- Empty state -->
        <div v-else-if="services.length === 0" class="flex flex-col items-center justify-center py-24 text-center space-y-6">
          <div class="w-32 h-32 bg-white rounded-full flex items-center justify-center shadow-sm border border-[var(--color-outline-variant)]/10">
            <span class="material-symbols-outlined text-6xl text-[var(--color-outline-variant)]" aria-hidden="true">inventory_2</span>
          </div>
          <div class="space-y-2">
            <h3 class="text-2xl font-bold text-[var(--color-on-surface)]">No tienes servicios aún</h3>
            <p class="text-[var(--color-on-surface-variant)] max-w-sm mx-auto">
              Comienza creando tu primer servicio para que tus clientes puedan agendar contigo.
            </p>
          </div>
          <button
            class="soul-gradient text-white px-8 py-3 rounded-lg font-bold shadow-sm hover:opacity-90 transition-all active:scale-95"
            @click="openCreate"
          >
            Crear mi primer servicio
          </button>
        </div>

        <!-- Service cards grid -->
        <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <ServiceAdminCard
            v-for="(s, idx) in services"
            :key="s.id"
            :service="s"
            :index="idx"
            @availability="availabilityService = s"
            @edit="openEdit(s)"
            @remove="servicesStore.remove(s.id)"
          />

          <!-- Add card -->
          <button
            class="group bg-white rounded-xl p-6 shadow-sm border-2 border-dashed border-[var(--color-outline-variant)]/30 hover:border-[var(--color-primary)]/40 hover:bg-[var(--color-primary)]/5 flex flex-col items-center justify-center text-center gap-4 cursor-pointer transition-all duration-200"
            @click="openCreate"
          >
            <div class="w-14 h-14 rounded-full bg-[var(--color-surface-container-high)] flex items-center justify-center group-hover:bg-[var(--color-primary)]/10 transition-colors">
              <span class="material-symbols-outlined text-3xl text-[var(--color-outline)] group-hover:text-[var(--color-primary)] transition-colors" aria-hidden="true">add</span>
            </div>
            <div>
              <p class="font-bold text-[var(--color-on-surface)]">Añadir nuevo servicio</p>
              <p class="text-sm text-[var(--color-on-surface-variant)]">Expande tu oferta comercial</p>
            </div>
          </button>
        </div>

        <!-- Stats footer -->
        <div v-if="services.length > 0" class="mt-16 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div class="p-5 bg-white rounded-xl shadow-sm border border-[var(--color-outline-variant)]/10">
            <p class="text-[10px] font-bold uppercase tracking-widest text-[var(--color-outline)] mb-1">Total Servicios</p>
            <p class="text-3xl font-black text-[var(--color-on-surface)]">{{ services.length }}</p>
          </div>
          <div class="p-5 bg-white rounded-xl shadow-sm border border-[var(--color-outline-variant)]/10">
            <p class="text-[10px] font-bold uppercase tracking-widest text-[var(--color-outline)] mb-1">Activos</p>
            <p class="text-3xl font-black text-emerald-600">{{ activeCount }}</p>
          </div>
          <div class="p-5 bg-white rounded-xl shadow-sm border border-[var(--color-outline-variant)]/10">
            <p class="text-[10px] font-bold uppercase tracking-widest text-[var(--color-outline)] mb-1">Duración Media</p>
            <p class="text-3xl font-black text-[var(--color-on-surface)]">{{ avgDuration }}m</p>
          </div>
          <div class="p-5 bg-white rounded-xl shadow-sm border border-[var(--color-outline-variant)]/10">
            <p class="text-[10px] font-bold uppercase tracking-widest text-[var(--color-outline)] mb-1">Precio Promedio</p>
            <p class="text-3xl font-black text-[var(--color-primary)]">${{ avgPrice }}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
