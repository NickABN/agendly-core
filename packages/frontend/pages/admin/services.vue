<script setup lang="ts">
definePageMeta({ layout: 'admin' });

const api = useApi();

interface Service {
  id: string;
  name: string;
  durationMinutes: number;
  bufferMinutes: number;
  priceMXN: string;
  isActive: boolean;
}

const services = ref<Service[]>([]);
const loading = ref(true);
const showForm = ref(false);
const editingId = ref<string | null>(null);

const form = reactive({
  name: '',
  durationMinutes: 30,
  priceMXN: 0,
});

async function loadServices() {
  loading.value = true;
  try {
    services.value = await api.get<Service[]>('/services');
  } finally {
    loading.value = false;
  }
}

function resetForm() {
  form.name = '';
  form.durationMinutes = 30;
  form.priceMXN = 0;
  editingId.value = null;
  showForm.value = false;
}

function startEdit(s: Service) {
  form.name = s.name;
  form.durationMinutes = s.durationMinutes;
  form.priceMXN = Number(s.priceMXN);
  editingId.value = s.id;
  showForm.value = true;
}

async function handleSubmit() {
  if (!form.name) return;
  if (editingId.value) {
    await api.patch(`/services/${editingId.value}`, { ...form });
  } else {
    await api.post('/services', { ...form });
  }
  resetForm();
  await loadServices();
}

async function deleteService(id: string) {
  await api.del(`/services/${id}`);
  await loadServices();
}

onMounted(loadServices);

// Computed stats
const totalServices = computed(() => services.value.length);
const activeCount = computed(() => services.value.filter((s) => s.isActive).length);
const avgDuration = computed(() => {
  if (!services.value.length) return 0;
  return Math.round(services.value.reduce((a, s) => a + s.durationMinutes, 0) / services.value.length);
});
const avgPrice = computed(() => {
  if (!services.value.length) return 0;
  return Math.round(services.value.reduce((a, s) => a + Number(s.priceMXN), 0) / services.value.length);
});

// Icon assignment by name heuristic
function getServiceIcon(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes('corte') || lower.includes('cabello')) return 'content_cut';
  if (lower.includes('manicure') || lower.includes('uña')) return 'spa';
  if (lower.includes('barba')) return 'face';
  if (lower.includes('color') || lower.includes('tinte') || lower.includes('tint')) return 'palette';
  if (lower.includes('masaje') || lower.includes('relaj')) return 'self_improvement';
  if (lower.includes('facial')) return 'face_retouching_natural';
  if (lower.includes('pedicure') || lower.includes('pie')) return 'podiatry';
  return 'content_cut';
}

// ─── Service Availability Editor ──────────────────
interface ServiceAvailItem {
  dayOfWeek: string;
  startTime: string | null;
  endTime: string | null;
}

const DAY_LABELS: Record<string, string> = {
  MONDAY: 'Lunes',
  TUESDAY: 'Martes',
  WEDNESDAY: 'Miércoles',
  THURSDAY: 'Jueves',
  FRIDAY: 'Viernes',
  SATURDAY: 'Sábado',
  SUNDAY: 'Domingo',
};
const DAYS_ORDER = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];

const availServiceId = ref<string | null>(null);
const availServiceName = ref('');
const availItems = ref<ServiceAvailItem[]>([]);
const availLoading = ref(false);
const availSaving = ref(false);
const availEnabled = ref(false);

async function openAvailability(s: Service) {
  availServiceId.value = s.id;
  availServiceName.value = s.name;
  availLoading.value = true;
  try {
    const data = await api.get<ServiceAvailItem[]>(`/services/${s.id}/availability`);
    if (data.length > 0) {
      availItems.value = data;
      availEnabled.value = true;
    } else {
      availItems.value = [];
      availEnabled.value = false;
    }
  } finally {
    availLoading.value = false;
  }
}

function closeAvailability() {
  availServiceId.value = null;
}

function toggleAvailEnabled() {
  availEnabled.value = !availEnabled.value;
  if (availEnabled.value && availItems.value.length === 0) {
    // Default: available Mon-Sat all day
    availItems.value = DAYS_ORDER.filter((d) => d !== 'SUNDAY').map((d) => ({
      dayOfWeek: d,
      startTime: '09:00',
      endTime: '19:00',
    }));
  }
}

function isAvailDayActive(day: string) {
  return availItems.value.some((i) => i.dayOfWeek === day);
}

function toggleAvailDay(day: string) {
  if (isAvailDayActive(day)) {
    availItems.value = availItems.value.filter((i) => i.dayOfWeek !== day);
  } else {
    availItems.value.push({ dayOfWeek: day, startTime: '09:00', endTime: '19:00' });
  }
}

function getAvailItem(day: string) {
  return availItems.value.find((i) => i.dayOfWeek === day);
}

async function saveAvailability() {
  if (!availServiceId.value) return;
  availSaving.value = true;
  try {
    const items = availEnabled.value ? availItems.value : [];
    await api.put(`/services/${availServiceId.value}/availability`, items);
    closeAvailability();
  } finally {
    availSaving.value = false;
  }
}

const iconColors = [
  { bg: 'bg-emerald-50', text: 'text-emerald-600' },
  { bg: 'bg-orange-50', text: 'text-orange-600' },
  { bg: 'bg-blue-50', text: 'text-blue-600' },
  { bg: 'bg-violet-50', text: 'text-violet-600' },
  { bg: 'bg-pink-50', text: 'text-pink-600' },
  { bg: 'bg-teal-50', text: 'text-teal-600' },
];
function getIconColor(i: number) {
  return iconColors[i % iconColors.length];
}
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <!-- Top bar -->
    <header
      class="flex items-center gap-4 px-6 h-16 bg-white/80 backdrop-blur-md border-b border-[var(--color-outline-variant)]/10 sticky top-0 z-40 shrink-0"
    >
      <h1 class="text-lg font-bold tracking-tight">Servicios</h1>
    </header>

    <!-- Content -->
    <div class="flex-1 overflow-y-auto p-6 lg:p-8">
      <div class="max-w-7xl mx-auto w-full">
        <!-- Breadcrumbs -->
        <nav class="flex items-center gap-2 text-sm text-[var(--color-on-surface-variant)] mb-6 font-medium">
          <NuxtLink to="/admin" class="hover:text-[var(--color-primary)] transition-colors">Panel</NuxtLink>
          <span class="material-symbols-outlined text-xs">chevron_right</span>
          <span class="text-[var(--color-on-surface)]">Servicios</span>
        </nav>

        <!-- Header -->
        <div class="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div class="space-y-1">
            <h2 class="text-3xl lg:text-4xl font-extrabold tracking-tight text-[var(--color-on-surface)]">
              Servicios
            </h2>
            <p class="text-[var(--color-on-surface-variant)] max-w-xl">
              Gestiona el catálogo de servicios de tu negocio, establece duraciones y precios
              personalizados para tus clientes.
            </p>
          </div>
          <button
            class="inline-flex items-center justify-center gap-2 soul-gradient text-white px-6 py-3 rounded-lg font-bold shadow-sm hover:opacity-90 transition-all active:scale-95 shrink-0"
            @click="showForm = true; editingId = null; form.name = ''; form.durationMinutes = 30; form.priceMXN = 0"
          >
            <span class="material-symbols-outlined text-lg">add_circle</span>
            Nuevo Servicio
          </button>
        </div>

        <!-- Add/Edit Form Modal Overlay -->
        <Teleport to="body">
          <Transition name="fade">
            <div
              v-if="showForm"
              class="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 backdrop-blur-sm p-6"
              @click.self="resetForm"
            >
              <div class="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl border border-[var(--color-outline-variant)]/10">
                <div class="flex items-center justify-between mb-6">
                  <h3 class="text-xl font-bold text-[var(--color-on-surface)]">
                    {{ editingId ? 'Editar Servicio' : 'Nuevo Servicio' }}
                  </h3>
                  <button
                    class="p-2 text-[var(--color-outline)] hover:text-[var(--color-on-surface)] transition-colors rounded-lg hover:bg-[var(--color-surface-container-high)]"
                    @click="resetForm"
                  >
                    <span class="material-symbols-outlined">close</span>
                  </button>
                </div>

                <form class="space-y-5" @submit.prevent="handleSubmit">
                  <div class="space-y-2">
                    <label class="text-xs font-bold text-[var(--color-outline)] uppercase tracking-wider">
                      Nombre del servicio
                    </label>
                    <input
                      v-model="form.name"
                      type="text"
                      required
                      placeholder="Ej: Corte de cabello"
                      class="w-full px-4 py-3 bg-[var(--color-surface-container-high)] border-none rounded-lg focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:bg-white transition-all outline-none"
                    />
                  </div>

                  <div class="grid grid-cols-2 gap-4">
                    <div class="space-y-2">
                      <label class="text-xs font-bold text-[var(--color-outline)] uppercase tracking-wider">
                        Duración
                      </label>
                      <select
                        v-model.number="form.durationMinutes"
                        class="w-full px-4 py-3 bg-[var(--color-surface-container-high)] border-none rounded-lg focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:bg-white transition-all outline-none appearance-none"
                      >
                        <option :value="15">15 min</option>
                        <option :value="30">30 min</option>
                        <option :value="45">45 min</option>
                        <option :value="60">60 min</option>
                        <option :value="90">90 min</option>
                        <option :value="120">2 horas</option>
                      </select>
                    </div>
                    <div class="space-y-2">
                      <label class="text-xs font-bold text-[var(--color-outline)] uppercase tracking-wider">
                        Precio (MXN)
                      </label>
                      <div class="relative">
                        <span
                          class="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-on-surface-variant)] font-semibold"
                        >$</span>
                        <input
                          v-model.number="form.priceMXN"
                          type="number"
                          min="0"
                          placeholder="0"
                          class="w-full pl-8 pr-4 py-3 bg-[var(--color-surface-container-high)] border-none rounded-lg focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:bg-white transition-all outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  <div class="flex gap-3 pt-2">
                    <button
                      type="submit"
                      class="flex-1 py-3 soul-gradient text-white font-bold rounded-lg hover:opacity-90 transition-all active:scale-[0.98]"
                    >
                      {{ editingId ? 'Guardar cambios' : 'Agregar servicio' }}
                    </button>
                    <button
                      type="button"
                      class="px-5 py-3 text-sm font-semibold text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface-container-high)] rounded-lg transition-colors"
                      @click="resetForm"
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </Transition>
        </Teleport>

        <!-- Service Availability Modal -->
        <Teleport to="body">
          <Transition name="fade">
            <div
              v-if="availServiceId"
              class="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 backdrop-blur-sm p-4"
              @click.self="closeAvailability"
            >
              <div class="bg-white rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-2xl border border-[var(--color-outline-variant)]/10">
                <!-- Header -->
                <div class="flex items-center justify-between p-6 pb-4 border-b border-[var(--color-outline-variant)]/10">
                  <div>
                    <h3 class="text-lg font-bold text-[var(--color-on-surface)]">Disponibilidad: {{ availServiceName }}</h3>
                    <p class="text-xs text-[var(--color-on-surface-variant)] mt-0.5">Restringe en qué días y horarios se ofrece este servicio</p>
                  </div>
                  <button class="p-2 text-[var(--color-outline)] hover:text-[var(--color-on-surface)] rounded-lg hover:bg-[var(--color-surface-container-high)] transition-colors" @click="closeAvailability">
                    <span class="material-symbols-outlined">close</span>
                  </button>
                </div>

                <div v-if="availLoading" class="flex-1 flex items-center justify-center py-12">
                  <div class="w-6 h-6 border-2 border-[var(--color-primary)]/30 border-t-[var(--color-primary)] rounded-full animate-spin"></div>
                </div>
                <div v-else class="flex-1 overflow-y-auto p-6 space-y-4">
                  <!-- Toggle -->
                  <div class="flex items-center justify-between p-4 rounded-xl bg-[var(--color-surface-container-low)] border border-[var(--color-outline-variant)]/10">
                    <div>
                      <p class="text-sm font-semibold text-[var(--color-on-surface)]">Restringir disponibilidad</p>
                      <p class="text-xs text-[var(--color-on-surface-variant)]">
                        {{ availEnabled ? 'Solo disponible en los días/horarios configurados' : 'Disponible siempre que el empleado tenga horario' }}
                      </p>
                    </div>
                    <button
                      class="w-12 h-7 rounded-full transition-colors relative"
                      :class="availEnabled ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-outline-variant)]/30'"
                      @click="toggleAvailEnabled"
                    >
                      <span
                        class="absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-transform"
                        :class="availEnabled ? 'translate-x-6' : 'translate-x-1'"
                      ></span>
                    </button>
                  </div>

                  <!-- Day list -->
                  <div v-if="availEnabled" class="space-y-2">
                    <div v-for="day in DAYS_ORDER" :key="day" class="flex items-center gap-3 p-3 rounded-lg border border-[var(--color-outline-variant)]/15">
                      <button
                        class="w-5 h-5 rounded flex items-center justify-center border-2 transition-all shrink-0"
                        :class="isAvailDayActive(day)
                          ? 'bg-[var(--color-primary)] border-[var(--color-primary)]'
                          : 'border-[var(--color-outline-variant)]/40 hover:border-[var(--color-primary)]/40'"
                        @click="toggleAvailDay(day)"
                      >
                        <span v-if="isAvailDayActive(day)" class="material-symbols-outlined text-white text-sm" style="font-variation-settings: 'wght' 600">check</span>
                      </button>
                      <span class="text-sm font-medium w-24 shrink-0" :class="isAvailDayActive(day) ? 'text-[var(--color-on-surface)]' : 'text-[var(--color-outline)]'">
                        {{ DAY_LABELS[day] }}
                      </span>
                      <template v-if="isAvailDayActive(day) && getAvailItem(day)">
                        <input
                          v-model="getAvailItem(day)!.startTime"
                          type="time"
                          class="flex-1 px-2 py-1.5 bg-[var(--color-surface-container-high)] border-none rounded text-sm focus:ring-2 focus:ring-[var(--color-primary)]/20 outline-none"
                        />
                        <span class="text-xs text-[var(--color-outline)]">a</span>
                        <input
                          v-model="getAvailItem(day)!.endTime"
                          type="time"
                          class="flex-1 px-2 py-1.5 bg-[var(--color-surface-container-high)] border-none rounded text-sm focus:ring-2 focus:ring-[var(--color-primary)]/20 outline-none"
                        />
                      </template>
                      <span v-else class="text-xs text-[var(--color-outline)] ml-auto">No disponible</span>
                    </div>
                  </div>
                </div>

                <!-- Footer -->
                <div class="p-6 pt-4 border-t border-[var(--color-outline-variant)]/10 flex gap-3">
                  <button
                    :disabled="availSaving"
                    class="flex-1 py-3 soul-gradient text-white font-bold rounded-lg hover:opacity-90 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
                    @click="saveAvailability"
                  >
                    <span v-if="availSaving" class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                    {{ availSaving ? 'Guardando...' : 'Guardar' }}
                  </button>
                  <button
                    class="px-5 py-3 text-sm font-semibold text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface-container-high)] rounded-lg transition-colors"
                    @click="closeAvailability"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          </Transition>
        </Teleport>

        <!-- Loading skeleton -->
        <div v-if="loading" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
        <div
          v-else-if="services.length === 0"
          class="flex flex-col items-center justify-center py-24 text-center space-y-6"
        >
          <div
            class="w-32 h-32 bg-white rounded-full flex items-center justify-center shadow-sm border border-[var(--color-outline-variant)]/10"
          >
            <span class="material-symbols-outlined text-6xl text-[var(--color-outline-variant)]">
              inventory_2
            </span>
          </div>
          <div class="space-y-2">
            <h3 class="text-2xl font-bold text-[var(--color-on-surface)]">No tienes servicios aún</h3>
            <p class="text-[var(--color-on-surface-variant)] max-w-sm mx-auto">
              Comienza creando tu primer servicio para que tus clientes puedan agendar contigo.
            </p>
          </div>
          <button
            class="soul-gradient text-white px-8 py-3 rounded-lg font-bold shadow-sm hover:opacity-90 transition-all active:scale-95"
            @click="showForm = true"
          >
            Crear mi primer servicio
          </button>
        </div>

        <!-- Service cards grid -->
        <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div
            v-for="(s, idx) in services"
            :key="s.id"
            class="group bg-white rounded-xl p-6 shadow-sm border border-[var(--color-outline-variant)]/10 transition-all duration-200 hover:shadow-md hover:border-[var(--color-primary)]/20 relative overflow-hidden"
          >
            <!-- Icon + actions -->
            <div class="flex justify-between items-start mb-4">
              <div
                class="p-2.5 rounded-lg"
                :class="[getIconColor(idx).bg, getIconColor(idx).text]"
              >
                <span class="material-symbols-outlined">{{ getServiceIcon(s.name) }}</span>
              </div>
              <div class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  class="p-2 text-[var(--color-outline)] hover:bg-[var(--color-surface-container-high)] rounded-full transition-colors"
                  title="Disponibilidad"
                  @click="openAvailability(s)"
                >
                  <span class="material-symbols-outlined text-base">calendar_month</span>
                </button>
                <button
                  class="p-2 text-[var(--color-outline)] hover:bg-[var(--color-surface-container-high)] rounded-full transition-colors"
                  @click="startEdit(s)"
                >
                  <span class="material-symbols-outlined text-base">edit</span>
                </button>
                <button
                  class="p-2 text-red-400 hover:bg-red-50 rounded-full transition-colors"
                  @click="deleteService(s.id)"
                >
                  <span class="material-symbols-outlined text-base">delete</span>
                </button>
              </div>
            </div>

            <!-- Name + badge -->
            <div class="flex items-center justify-between mb-1">
              <h3 class="text-lg font-bold text-[var(--color-on-surface)]">{{ s.name }}</h3>
              <span
                class="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full"
                :class="
                  s.isActive
                    ? 'text-emerald-700 bg-emerald-50 border border-emerald-100'
                    : 'text-slate-500 bg-slate-50 border border-slate-200'
                "
              >
                {{ s.isActive ? 'Activo' : 'Pausado' }}
              </span>
            </div>

            <!-- Duration + Price -->
            <div class="pt-4 mt-3 flex items-center justify-between border-t border-[var(--color-outline-variant)]/10">
              <div class="flex items-center gap-2 text-[var(--color-on-surface-variant)]">
                <span class="material-symbols-outlined text-lg">schedule</span>
                <span class="text-sm font-medium">{{ s.durationMinutes }} min</span>
              </div>
              <div class="text-2xl font-black text-[var(--color-primary)]">${{ s.priceMXN }}</div>
            </div>
          </div>

          <!-- Add card -->
          <div
            class="group bg-white rounded-xl p-6 shadow-sm border-2 border-dashed border-[var(--color-outline-variant)]/30 hover:border-[var(--color-primary)]/40 hover:bg-[var(--color-primary)]/5 flex flex-col items-center justify-center text-center gap-4 cursor-pointer transition-all duration-200"
            @click="showForm = true; editingId = null"
          >
            <div
              class="w-14 h-14 rounded-full bg-[var(--color-surface-container-high)] flex items-center justify-center group-hover:bg-[var(--color-primary)]/10 transition-colors"
            >
              <span
                class="material-symbols-outlined text-3xl text-[var(--color-outline)] group-hover:text-[var(--color-primary)] transition-colors"
              >add</span>
            </div>
            <div>
              <p class="font-bold text-[var(--color-on-surface)]">Añadir nuevo servicio</p>
              <p class="text-sm text-[var(--color-on-surface-variant)]">Expande tu oferta comercial</p>
            </div>
          </div>
        </div>

        <!-- Stats footer -->
        <div v-if="services.length > 0" class="mt-16 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div class="p-5 bg-white rounded-xl shadow-sm border border-[var(--color-outline-variant)]/10">
            <p class="text-[10px] font-bold uppercase tracking-widest text-[var(--color-outline)] mb-1">
              Total Servicios
            </p>
            <p class="text-3xl font-black text-[var(--color-on-surface)]">{{ totalServices }}</p>
          </div>
          <div class="p-5 bg-white rounded-xl shadow-sm border border-[var(--color-outline-variant)]/10">
            <p class="text-[10px] font-bold uppercase tracking-widest text-[var(--color-outline)] mb-1">
              Activos
            </p>
            <p class="text-3xl font-black text-emerald-600">{{ activeCount }}</p>
          </div>
          <div class="p-5 bg-white rounded-xl shadow-sm border border-[var(--color-outline-variant)]/10">
            <p class="text-[10px] font-bold uppercase tracking-widest text-[var(--color-outline)] mb-1">
              Duración Media
            </p>
            <p class="text-3xl font-black text-[var(--color-on-surface)]">{{ avgDuration }}m</p>
          </div>
          <div class="p-5 bg-white rounded-xl shadow-sm border border-[var(--color-outline-variant)]/10">
            <p class="text-[10px] font-bold uppercase tracking-widest text-[var(--color-outline)] mb-1">
              Precio Promedio
            </p>
            <p class="text-3xl font-black text-[var(--color-primary)]">${{ avgPrice }}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
