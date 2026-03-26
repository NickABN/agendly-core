<script setup lang="ts">
definePageMeta({ layout: 'admin' });

const { store } = useAuth();
const api = useApi();

const activeTab = ref('business');

// ─── Business Info ──────────────────────────
const businessForm = reactive({
  name: '',
  slug: '',
  phone: '',
  address: '',
});
const businessLoading = ref(false);
const businessSuccess = ref(false);

async function loadTenant() {
  const tenant = await api.get<{
    id: string; name: string; slug: string; phone: string | null;
    address: string | null; timezone: string;
  }>('/tenant');
  businessForm.name = tenant.name;
  businessForm.slug = tenant.slug;
  businessForm.phone = tenant.phone || '';
  businessForm.address = tenant.address || '';
}

async function saveBusiness() {
  businessLoading.value = true;
  businessSuccess.value = false;
  try {
    await api.patch('/tenant', businessForm);
    businessSuccess.value = true;
    setTimeout(() => (businessSuccess.value = false), 3000);
  } finally {
    businessLoading.value = false;
  }
}

// ─── Services ───────────────────────────────
interface Service {
  id: string; name: string; durationMinutes: number;
  bufferMinutes: number; priceMXN: string; isActive: boolean;
}

const services = ref<Service[]>([]);
const newService = reactive({ name: '', durationMinutes: 30, priceMXN: 0 });

async function loadServices() {
  services.value = await api.get<Service[]>('/services');
}

async function addService() {
  if (!newService.name) return;
  await api.post('/services', newService);
  newService.name = '';
  newService.durationMinutes = 30;
  newService.priceMXN = 0;
  await loadServices();
}

async function deleteService(id: string) {
  await api.del(`/services/${id}`);
  await loadServices();
}

// ─── Employees ──────────────────────────────
interface Employee {
  id: string; name: string; isActive: boolean; serviceIds: string[];
}

const employees = ref<Employee[]>([]);
const newEmployeeName = ref('');

async function loadEmployees() {
  employees.value = await api.get<Employee[]>('/employees');
}

async function addEmployee() {
  if (!newEmployeeName.value) return;
  await api.post('/employees', { name: newEmployeeName.value });
  newEmployeeName.value = '';
  await loadEmployees();
}

async function deleteEmployee(id: string) {
  await api.del(`/employees/${id}`);
  await loadEmployees();
}

onMounted(async () => {
  await Promise.all([loadTenant(), loadServices(), loadEmployees()]);
});

function getInitials(name: string) {
  return name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2);
}

const avatarColors = ['bg-violet-400', 'bg-emerald-500', 'bg-blue-500', 'bg-orange-400', 'bg-pink-400', 'bg-teal-500'];
function getColor(i: number) { return avatarColors[i % avatarColors.length]; }

const tabs = [
  { key: 'business', label: 'Negocio', icon: 'storefront' },
  { key: 'services', label: 'Servicios', icon: 'content_cut' },
  { key: 'employees', label: 'Equipo', icon: 'badge' },
];
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <!-- Top bar -->
    <header class="flex items-center gap-4 px-6 h-16 bg-white/80 backdrop-blur-md border-b border-[var(--color-outline-variant)]/10 sticky top-0 z-40 shrink-0">
      <NuxtLink to="/admin" class="p-2 text-[var(--color-on-surface-variant)] hover:text-[var(--color-on-surface)] transition-colors">
        <span class="material-symbols-outlined">arrow_back</span>
      </NuxtLink>
      <h1 class="text-lg font-bold tracking-tight">Configuración</h1>
    </header>

    <!-- Content -->
    <div class="flex-1 overflow-y-auto p-6 max-w-4xl mx-auto w-full">
      <div class="mb-8">
        <h2 class="text-2xl font-bold mb-1">Configuración</h2>
        <p class="text-sm text-[var(--color-on-surface-variant)]">Gestiona la identidad de tu negocio y tus horarios de atención.</p>
      </div>

      <!-- Tabs -->
      <div class="flex gap-1 mb-8 bg-[var(--color-surface-container-high)] p-1 rounded-xl w-fit">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          class="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all"
          :class="activeTab === tab.key
            ? 'bg-white text-[var(--color-on-surface)] shadow-sm'
            : 'text-[var(--color-on-surface-variant)] hover:text-[var(--color-on-surface)]'"
          @click="activeTab = tab.key"
        >
          <span class="material-symbols-outlined text-base">{{ tab.icon }}</span>
          {{ tab.label }}
        </button>
      </div>

      <!-- Business tab -->
      <div v-if="activeTab === 'business'" class="space-y-6">
        <!-- Success banner -->
        <div v-if="businessSuccess" class="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 border border-emerald-100">
          <span class="material-symbols-outlined text-emerald-600" style="font-variation-settings: 'FILL' 1">check_circle</span>
          <p class="text-sm font-semibold text-emerald-700">Cambios guardados correctamente.</p>
        </div>

        <form class="space-y-6" @submit.prevent="saveBusiness">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="space-y-2">
              <label class="text-xs font-bold text-[var(--color-outline)] uppercase tracking-wider">Nombre del negocio</label>
              <input
                v-model="businessForm.name"
                type="text"
                class="w-full px-4 py-3 bg-[var(--color-surface-container-high)] border-none rounded-lg focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:bg-[var(--color-surface-container-lowest)] transition-all outline-none"
              />
            </div>
            <div class="space-y-2">
              <label class="text-xs font-bold text-[var(--color-outline)] uppercase tracking-wider">URL de reservas</label>
              <div class="relative flex items-center">
                <span class="absolute left-4 text-[var(--color-on-surface-variant)] text-sm font-medium">agendly.mx/</span>
                <input
                  v-model="businessForm.slug"
                  type="text"
                  class="w-full pl-[100px] pr-4 py-3 bg-[var(--color-surface-container-high)] border-none rounded-lg focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:bg-[var(--color-surface-container-lowest)] transition-all outline-none"
                />
              </div>
            </div>
            <div class="space-y-2">
              <label class="text-xs font-bold text-[var(--color-outline)] uppercase tracking-wider">Teléfono</label>
              <input
                v-model="businessForm.phone"
                type="tel"
                class="w-full px-4 py-3 bg-[var(--color-surface-container-high)] border-none rounded-lg focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:bg-[var(--color-surface-container-lowest)] transition-all outline-none"
              />
            </div>
            <div class="space-y-2">
              <label class="text-xs font-bold text-[var(--color-outline)] uppercase tracking-wider">Dirección</label>
              <input
                v-model="businessForm.address"
                type="text"
                class="w-full px-4 py-3 bg-[var(--color-surface-container-high)] border-none rounded-lg focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:bg-[var(--color-surface-container-lowest)] transition-all outline-none"
              />
            </div>
          </div>

          <div class="flex items-center gap-3 pt-2">
            <button
              type="submit"
              :disabled="businessLoading"
              class="bg-[var(--color-primary)] text-white px-8 py-3 rounded-lg font-semibold hover:bg-[var(--color-primary-container)] transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              <span v-if="businessLoading" class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
              {{ businessLoading ? 'Guardando...' : 'Guardar cambios' }}
            </button>
            <button type="button" class="px-4 py-3 text-sm font-semibold text-[var(--color-on-surface-variant)] hover:text-[var(--color-on-surface)] transition-colors">
              Descartar
            </button>
          </div>
        </form>
      </div>

      <!-- Services tab -->
      <div v-if="activeTab === 'services'" class="space-y-6">
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div
            v-for="s in services"
            :key="s.id"
            class="bg-[var(--color-surface-container-lowest)] rounded-xl p-5 editorial-shadow border border-[var(--color-outline-variant)]/10 group"
          >
            <div class="flex items-start justify-between mb-3">
              <div class="p-2 bg-[var(--color-primary)]/10 rounded-lg">
                <span class="material-symbols-outlined text-[var(--color-primary)] text-xl">content_cut</span>
              </div>
              <div class="flex items-center gap-1">
                <span
                  class="text-[10px] px-2 py-0.5 rounded-full font-bold"
                  :class="s.isActive ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-slate-100 text-slate-500 border border-slate-200'"
                >
                  {{ s.isActive ? 'Activo' : 'Pausado' }}
                </span>
                <button
                  class="p-1.5 text-[var(--color-outline)] hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                  @click="deleteService(s.id)"
                >
                  <span class="material-symbols-outlined text-base">delete</span>
                </button>
              </div>
            </div>
            <h3 class="font-bold text-[var(--color-on-surface)] mb-1">{{ s.name }}</h3>
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-1 text-xs text-[var(--color-on-surface-variant)]">
                <span class="material-symbols-outlined text-sm">schedule</span>
                {{ s.durationMinutes }} min
              </div>
              <span class="text-lg font-bold text-[var(--color-primary)]">${{ s.priceMXN }}</span>
            </div>
          </div>

          <!-- Add new service card -->
          <div class="bg-[var(--color-surface-container-low)] rounded-xl p-5 border-2 border-dashed border-[var(--color-outline-variant)]/40 space-y-4">
            <p class="text-xs font-bold text-[var(--color-outline)] uppercase tracking-wider">Nuevo servicio</p>
            <div class="space-y-3">
              <input
                v-model="newService.name"
                type="text"
                placeholder="Nombre del servicio"
                class="w-full px-3 py-2 bg-white border-none rounded-lg text-sm focus:ring-2 focus:ring-[var(--color-primary)]/20 outline-none transition-all"
              />
              <div class="grid grid-cols-2 gap-2">
                <select
                  v-model.number="newService.durationMinutes"
                  class="px-3 py-2 bg-white border-none rounded-lg text-sm focus:ring-2 focus:ring-[var(--color-primary)]/20 outline-none transition-all appearance-none"
                >
                  <option :value="15">15 min</option>
                  <option :value="30">30 min</option>
                  <option :value="45">45 min</option>
                  <option :value="60">60 min</option>
                  <option :value="90">90 min</option>
                  <option :value="120">2 horas</option>
                </select>
                <div class="relative">
                  <span class="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-on-surface-variant)] text-sm">$</span>
                  <input
                    v-model.number="newService.priceMXN"
                    type="number"
                    placeholder="Precio"
                    class="w-full pl-6 pr-3 py-2 bg-white border-none rounded-lg text-sm focus:ring-2 focus:ring-[var(--color-primary)]/20 outline-none transition-all"
                  />
                </div>
              </div>
            </div>
            <button
              class="w-full py-2 bg-[var(--color-primary)] text-white rounded-lg text-sm font-semibold hover:bg-[var(--color-primary-container)] transition-colors flex items-center justify-center gap-1"
              @click="addService"
            >
              <span class="material-symbols-outlined text-base">add</span>
              Agregar servicio
            </button>
          </div>
        </div>
      </div>

      <!-- Employees tab -->
      <div v-if="activeTab === 'employees'" class="space-y-4">
        <div
          v-for="(e, idx) in employees"
          :key="e.id"
          class="flex items-center gap-4 p-4 bg-[var(--color-surface-container-lowest)] rounded-xl editorial-shadow border border-[var(--color-outline-variant)]/10 group"
        >
          <div
            class="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
            :class="getColor(idx)"
          >
            {{ getInitials(e.name) }}
          </div>
          <div class="flex-1">
            <p class="font-semibold text-[var(--color-on-surface)]">{{ e.name }}</p>
            <div class="flex items-center gap-1 mt-0.5">
              <span class="w-1.5 h-1.5 rounded-full" :class="e.isActive ? 'bg-emerald-500' : 'bg-slate-300'"></span>
              <span class="text-xs text-[var(--color-on-surface-variant)]">{{ e.isActive ? 'Activo' : 'Inactivo' }}</span>
            </div>
          </div>
          <button
            class="p-2 text-[var(--color-outline)] hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
            @click="deleteEmployee(e.id)"
          >
            <span class="material-symbols-outlined">delete</span>
          </button>
        </div>

        <!-- Add employee -->
        <div class="flex gap-3 mt-2">
          <input
            v-model="newEmployeeName"
            type="text"
            placeholder="Nombre del colaborador"
            class="flex-1 px-4 py-3 bg-[var(--color-surface-container-high)] border-none rounded-lg text-sm focus:ring-2 focus:ring-[var(--color-primary)]/20 outline-none transition-all"
            @keyup.enter="addEmployee"
          />
          <button
            class="px-5 py-3 bg-[var(--color-primary)] text-white rounded-lg font-semibold text-sm hover:bg-[var(--color-primary-container)] transition-colors flex items-center gap-1"
            @click="addEmployee"
          >
            <span class="material-symbols-outlined text-base">add</span>
            Agregar
          </button>
        </div>
      </div>

    </div>
  </div>
</template>
