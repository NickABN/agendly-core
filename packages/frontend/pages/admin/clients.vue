<script setup lang="ts">
definePageMeta({ layout: 'admin' });

const api = useApi();

interface Client {
  name: string;
  phone: string;
  email: string | null;
  totalVisits: number;
  completedVisits: number;
  cancelledVisits: number;
  noShowVisits: number;
  lastVisit: string;
  topService: string;
}

const clients = ref<Client[]>([]);
const loading = ref(true);
const search = ref('');

async function loadClients() {
  loading.value = true;
  try {
    clients.value = await api.get<Client[]>('/appointments/clients');
  } finally {
    loading.value = false;
  }
}

onMounted(loadClients);

const filtered = computed(() => {
  if (!search.value) return clients.value;
  const q = search.value.toLowerCase();
  return clients.value.filter(
    (c) =>
      c.name.toLowerCase().includes(q) ||
      c.phone.includes(q) ||
      (c.email && c.email.toLowerCase().includes(q)),
  );
});

// Stats
const totalClients = computed(() => clients.value.length);
const totalVisits = computed(() => clients.value.reduce((a, c) => a + c.totalVisits, 0));
const avgVisits = computed(() => {
  if (!clients.value.length) return 0;
  return (totalVisits.value / clients.value.length).toFixed(1);
});
const topClient = computed(() => {
  if (!clients.value.length) return '—';
  return clients.value[0]?.name || '—';
});

// Helpers
function getInitials(name: string) {
  return name
    .split(' ')
    .map((w: string) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

const avatarColors = [
  'bg-violet-500',
  'bg-emerald-500',
  'bg-blue-500',
  'bg-orange-400',
  'bg-pink-500',
  'bg-teal-500',
  'bg-indigo-500',
  'bg-rose-500',
];
function getColor(i: number) {
  return avatarColors[i % avatarColors.length];
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatPhone(phone: string) {
  // Format Mexican phone numbers: 55 1234 5678
  if (phone.length === 10) {
    return `${phone.slice(0, 2)} ${phone.slice(2, 6)} ${phone.slice(6)}`;
  }
  return phone;
}
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <!-- Top bar -->
    <header
      class="flex items-center gap-4 px-6 h-16 bg-white/80 backdrop-blur-md border-b border-[var(--color-outline-variant)]/10 sticky top-0 z-40 shrink-0"
    >
      <h1 class="text-lg font-bold tracking-tight">Clientes</h1>
      <div class="flex-1"></div>
      <!-- Search -->
      <div class="relative w-72">
        <span
          class="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-[var(--color-outline)] text-lg"
        >search</span>
        <input
          v-model="search"
          type="text"
          placeholder="Buscar por nombre o teléfono..."
          class="w-full pl-10 pr-4 py-2 bg-[var(--color-surface-container-high)] border-none rounded-lg text-sm focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:bg-white transition-all outline-none"
        />
      </div>
    </header>

    <!-- Content -->
    <div class="flex-1 overflow-y-auto p-6 lg:p-8">
      <div class="max-w-6xl mx-auto w-full">
        <!-- Breadcrumbs -->
        <nav
          class="flex items-center gap-2 text-sm text-[var(--color-on-surface-variant)] mb-6 font-medium"
        >
          <NuxtLink to="/admin" class="hover:text-[var(--color-primary)] transition-colors">
            Panel
          </NuxtLink>
          <span class="material-symbols-outlined text-xs">chevron_right</span>
          <span class="text-[var(--color-on-surface)]">Clientes</span>
        </nav>

        <!-- Header -->
        <div class="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div class="space-y-1">
            <h2
              class="text-3xl lg:text-4xl font-extrabold tracking-tight text-[var(--color-on-surface)]"
            >
              Clientes
            </h2>
            <p class="text-[var(--color-on-surface-variant)] max-w-xl">
              Directorio de todas las personas que han reservado contigo. Se actualiza
              automáticamente con cada cita.
            </p>
          </div>
        </div>

        <!-- Stats -->
        <div v-if="!loading && clients.length > 0" class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          <div
            class="p-5 bg-white rounded-xl shadow-sm border border-[var(--color-outline-variant)]/10"
          >
            <p
              class="text-[10px] font-bold uppercase tracking-widest text-[var(--color-outline)] mb-1"
            >
              Total Clientes
            </p>
            <p class="text-3xl font-black text-[var(--color-on-surface)]">{{ totalClients }}</p>
          </div>
          <div
            class="p-5 bg-white rounded-xl shadow-sm border border-[var(--color-outline-variant)]/10"
          >
            <p
              class="text-[10px] font-bold uppercase tracking-widest text-[var(--color-outline)] mb-1"
            >
              Total Citas
            </p>
            <p class="text-3xl font-black text-[var(--color-primary)]">{{ totalVisits }}</p>
          </div>
          <div
            class="p-5 bg-white rounded-xl shadow-sm border border-[var(--color-outline-variant)]/10"
          >
            <p
              class="text-[10px] font-bold uppercase tracking-widest text-[var(--color-outline)] mb-1"
            >
              Promedio Visitas
            </p>
            <p class="text-3xl font-black text-emerald-600">{{ avgVisits }}</p>
          </div>
          <div
            class="p-5 bg-white rounded-xl shadow-sm border border-[var(--color-outline-variant)]/10"
          >
            <p
              class="text-[10px] font-bold uppercase tracking-widest text-[var(--color-outline)] mb-1"
            >
              Cliente Top
            </p>
            <p class="text-xl font-black text-[var(--color-on-surface)] truncate">
              {{ topClient }}
            </p>
          </div>
        </div>

        <!-- Loading skeleton -->
        <div v-if="loading" class="space-y-3">
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
        <div
          v-else-if="clients.length === 0"
          class="flex flex-col items-center justify-center py-24 text-center space-y-6"
        >
          <div
            class="w-32 h-32 bg-white rounded-full flex items-center justify-center shadow-sm border border-[var(--color-outline-variant)]/10"
          >
            <span class="material-symbols-outlined text-6xl text-[var(--color-outline-variant)]">
              person_search
            </span>
          </div>
          <div class="space-y-2">
            <h3 class="text-2xl font-bold text-[var(--color-on-surface)]">
              Aún no tienes clientes
            </h3>
            <p class="text-[var(--color-on-surface-variant)] max-w-sm mx-auto">
              Cuando alguien reserve una cita contigo, aparecerá aquí automáticamente.
            </p>
          </div>
        </div>

        <!-- No search results -->
        <div
          v-else-if="filtered.length === 0 && search"
          class="flex flex-col items-center justify-center py-16 text-center space-y-4"
        >
          <span class="material-symbols-outlined text-5xl text-[var(--color-outline-variant)]">
            search_off
          </span>
          <p class="text-[var(--color-on-surface-variant)]">
            No se encontraron clientes con "{{ search }}"
          </p>
        </div>

        <!-- Client list -->
        <div v-else class="space-y-3">
          <div
            v-for="(c, idx) in filtered"
            :key="c.phone"
            class="group flex items-center gap-5 p-5 bg-white rounded-xl shadow-sm border border-[var(--color-outline-variant)]/10 transition-all duration-200 hover:shadow-md hover:border-[var(--color-primary)]/20"
          >
            <!-- Avatar -->
            <div
              class="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
              :class="getColor(idx)"
            >
              {{ getInitials(c.name) }}
            </div>

            <!-- Info -->
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-3 mb-0.5">
                <h3 class="font-bold text-[var(--color-on-surface)] truncate">{{ c.name }}</h3>
                <span
                  v-if="c.totalVisits >= 5"
                  class="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full text-amber-700 bg-amber-50 border border-amber-100 shrink-0"
                >
                  <span class="material-symbols-outlined text-[10px] align-middle mr-0.5" style="font-variation-settings: 'FILL' 1;">star</span>
                  Frecuente
                </span>
              </div>
              <div class="flex items-center gap-4 text-sm text-[var(--color-on-surface-variant)]">
                <span class="flex items-center gap-1">
                  <span class="material-symbols-outlined text-sm">phone</span>
                  {{ formatPhone(c.phone) }}
                </span>
                <span v-if="c.email" class="flex items-center gap-1 truncate">
                  <span class="material-symbols-outlined text-sm">mail</span>
                  {{ c.email }}
                </span>
              </div>
            </div>

            <!-- Service + visits -->
            <div class="hidden md:flex flex-col items-end gap-1 shrink-0">
              <span class="text-xs font-medium text-[var(--color-on-surface-variant)]">
                {{ c.topService }}
              </span>
              <span class="text-xs text-[var(--color-outline)]">
                Última: {{ formatDate(c.lastVisit) }}
              </span>
            </div>

            <!-- Visit count -->
            <div
              class="flex flex-col items-center justify-center px-4 py-2 rounded-xl bg-[var(--color-surface-container-low)] shrink-0"
            >
              <span class="text-xl font-black text-[var(--color-primary)]">
                {{ c.totalVisits }}
              </span>
              <span class="text-[10px] font-semibold text-[var(--color-on-surface-variant)] uppercase tracking-wider">
                {{ c.totalVisits === 1 ? 'Visita' : 'Visitas' }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
