<script setup lang="ts">
import type { EmployeeItem } from '~/composables/useEmployees';

definePageMeta({ layout: 'admin' });

const employeesStore = useEmployees();
const servicesStore = useServices();

const showForm = ref(false);
const editing = ref<EmployeeItem | null>(null);
const scheduleEmployee = ref<{ id: string; name: string } | null>(null);

const loading = computed(() => employeesStore.pending.value || servicesStore.pending.value);
const employees = employeesStore.items;
const services = servicesStore.items;

const activeCount = computed(() => employees.value.filter((e) => e.isActive).length);

function serviceNames(ids: string[]) {
  return ids
    .map((id) => services.value.find((s) => s.id === id)?.name)
    .filter(Boolean)
    .join(', ');
}

function openCreate() {
  editing.value = null;
  showForm.value = true;
}

function openEdit(employee: EmployeeItem) {
  editing.value = employee;
  showForm.value = true;
}

async function onSubmit(data: { name: string; serviceIds: string[] }) {
  if (editing.value) {
    await employeesStore.update(editing.value.id, data);
  } else {
    await employeesStore.create(data);
  }
  showForm.value = false;
  editing.value = null;
}

onMounted(() => {
  void employeesStore.load();
  void servicesStore.load();
});
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <!-- Top bar -->
    <header class="flex items-center gap-4 px-4 md:px-6 h-16 bg-white/80 backdrop-blur-md border-b border-[var(--color-outline-variant)]/10 sticky top-0 z-40 shrink-0">
      <h1 class="text-lg font-bold tracking-tight">Personal</h1>
    </header>

    <!-- Content -->
    <div class="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
      <div class="max-w-5xl mx-auto w-full">
        <!-- Breadcrumbs -->
        <nav class="flex items-center gap-2 text-sm text-[var(--color-on-surface-variant)] mb-6 font-medium" aria-label="Migas de pan">
          <NuxtLink to="/admin" class="hover:text-[var(--color-primary)] transition-colors">Panel</NuxtLink>
          <span class="material-symbols-outlined text-xs" aria-hidden="true">chevron_right</span>
          <span class="text-[var(--color-on-surface)]">Personal</span>
        </nav>

        <!-- Header -->
        <div class="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div class="space-y-1">
            <h2 class="text-3xl lg:text-4xl font-extrabold tracking-tight text-[var(--color-on-surface)]">Tu Equipo</h2>
            <p class="text-[var(--color-on-surface-variant)] max-w-xl">
              Administra a los colaboradores de tu negocio y asigna los servicios que ofrece cada uno.
            </p>
          </div>
          <button
            class="inline-flex items-center justify-center gap-2 soul-gradient text-white px-6 py-3 rounded-lg font-bold shadow-sm hover:opacity-90 transition-all active:scale-95 shrink-0"
            @click="openCreate"
          >
            <span class="material-symbols-outlined text-lg" aria-hidden="true">person_add</span>
            Nuevo Colaborador
          </button>
        </div>

        <StaffFormModal
          v-model:open="showForm"
          :services="services"
          :editing="editing"
          @submit="onSubmit"
        />

        <StaffScheduleEditorModal
          :employee="scheduleEmployee"
          @close="scheduleEmployee = null"
        />

        <!-- Loading skeleton -->
        <div v-if="loading && employees.length === 0" class="space-y-4" role="status" aria-label="Cargando personal">
          <div
            v-for="i in 3"
            :key="i"
            class="flex items-center gap-4 p-5 bg-white rounded-xl shadow-sm border border-[var(--color-outline-variant)]/10 animate-pulse"
          >
            <div class="w-12 h-12 rounded-full bg-slate-100"></div>
            <div class="flex-1 space-y-2">
              <div class="h-4 w-32 bg-slate-100 rounded"></div>
              <div class="h-3 w-48 bg-slate-50 rounded"></div>
            </div>
          </div>
        </div>

        <!-- Empty state -->
        <div v-else-if="employees.length === 0" class="flex flex-col items-center justify-center py-24 text-center space-y-6">
          <div class="w-32 h-32 bg-white rounded-full flex items-center justify-center shadow-sm border border-[var(--color-outline-variant)]/10">
            <span class="material-symbols-outlined text-6xl text-[var(--color-outline-variant)]" aria-hidden="true">group_off</span>
          </div>
          <div class="space-y-2">
            <h3 class="text-2xl font-bold text-[var(--color-on-surface)]">Aún no tienes colaboradores</h3>
            <p class="text-[var(--color-on-surface-variant)] max-w-sm mx-auto">
              Agrega a tu equipo para que tus clientes puedan elegir con quién agendar.
            </p>
          </div>
          <button
            class="soul-gradient text-white px-8 py-3 rounded-lg font-bold shadow-sm hover:opacity-90 transition-all active:scale-95"
            @click="openCreate"
          >
            Agregar primer colaborador
          </button>
        </div>

        <!-- Employee list -->
        <div v-else class="space-y-3">
          <StaffListItem
            v-for="(e, idx) in employees"
            :key="e.id"
            :employee="e"
            :index="idx"
            :service-names="serviceNames(e.serviceIds)"
            @schedule="scheduleEmployee = { id: e.id, name: e.name }"
            @edit="openEdit(e)"
            @remove="employeesStore.remove(e.id)"
          />
        </div>

        <!-- Stats -->
        <div v-if="employees.length > 0" class="mt-16 grid grid-cols-2 md:grid-cols-3 gap-4">
          <div class="p-5 bg-white rounded-xl shadow-sm border border-[var(--color-outline-variant)]/10">
            <p class="text-[10px] font-bold uppercase tracking-widest text-[var(--color-outline)] mb-1">Total Colaboradores</p>
            <p class="text-3xl font-black text-[var(--color-on-surface)]">{{ employees.length }}</p>
          </div>
          <div class="p-5 bg-white rounded-xl shadow-sm border border-[var(--color-outline-variant)]/10">
            <p class="text-[10px] font-bold uppercase tracking-widest text-[var(--color-outline)] mb-1">Activos</p>
            <p class="text-3xl font-black text-emerald-600">{{ activeCount }}</p>
          </div>
          <div class="p-5 bg-white rounded-xl shadow-sm border border-[var(--color-outline-variant)]/10">
            <p class="text-[10px] font-bold uppercase tracking-widest text-[var(--color-outline)] mb-1">Servicios Disponibles</p>
            <p class="text-3xl font-black text-[var(--color-primary)]">{{ services.length }}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
