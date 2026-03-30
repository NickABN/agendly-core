<script setup lang="ts">
definePageMeta({ layout: 'admin' });

const api = useApi();

interface Service {
  id: string;
  name: string;
  durationMinutes: number;
  priceMXN: string;
  isActive: boolean;
}

interface Employee {
  id: string;
  name: string;
  isActive: boolean;
  serviceIds: string[];
}

const employees = ref<Employee[]>([]);
const services = ref<Service[]>([]);
const loading = ref(true);
const showForm = ref(false);
const editingId = ref<string | null>(null);

const form = reactive({
  name: '',
  serviceIds: [] as string[],
});

async function loadData() {
  loading.value = true;
  try {
    const [emp, svc] = await Promise.all([
      api.get<Employee[]>('/employees'),
      api.get<Service[]>('/services'),
    ]);
    employees.value = emp;
    services.value = svc;
  } finally {
    loading.value = false;
  }
}

function resetForm() {
  form.name = '';
  form.serviceIds = [];
  editingId.value = null;
  showForm.value = false;
}

function startEdit(e: Employee) {
  form.name = e.name;
  form.serviceIds = [...e.serviceIds];
  editingId.value = e.id;
  showForm.value = true;
}

async function handleSubmit() {
  if (!form.name) return;
  if (editingId.value) {
    await api.patch(`/employees/${editingId.value}`, { ...form });
  } else {
    await api.post('/employees', { ...form });
  }
  resetForm();
  await loadData();
}

async function deleteEmployee(id: string) {
  await api.del(`/employees/${id}`);
  await loadData();
}

function toggleService(id: string) {
  const idx = form.serviceIds.indexOf(id);
  if (idx >= 0) form.serviceIds.splice(idx, 1);
  else form.serviceIds.push(id);
}

onMounted(loadData);

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
  { bg: 'bg-violet-500', ring: 'ring-violet-200' },
  { bg: 'bg-emerald-500', ring: 'ring-emerald-200' },
  { bg: 'bg-blue-500', ring: 'ring-blue-200' },
  { bg: 'bg-orange-400', ring: 'ring-orange-200' },
  { bg: 'bg-pink-500', ring: 'ring-pink-200' },
  { bg: 'bg-teal-500', ring: 'ring-teal-200' },
];
function getAvatarColor(i: number) {
  return avatarColors[i % avatarColors.length];
}

function getServiceNames(ids: string[]) {
  return ids
    .map((id) => services.value.find((s) => s.id === id)?.name)
    .filter(Boolean)
    .join(', ');
}

const activeCount = computed(() => employees.value.filter((e) => e.isActive).length);

// ─── Schedule Editor ──────────────────────────
interface ScheduleBlock {
  dayOfWeek: string;
  blockIndex: number;
  startTime: string;
  endTime: string;
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

const scheduleEmployeeId = ref<string | null>(null);
const scheduleEmployeeName = ref('');
const scheduleBlocks = ref<ScheduleBlock[]>([]);
const scheduleLoading = ref(false);
const scheduleSaving = ref(false);

async function openSchedule(e: Employee) {
  scheduleEmployeeId.value = e.id;
  scheduleEmployeeName.value = e.name;
  scheduleLoading.value = true;
  try {
    const data = await api.get<ScheduleBlock[]>(`/schedules/employee/${e.id}`);
    scheduleBlocks.value = data.length > 0 ? data : DAYS_ORDER.filter(d => d !== 'SUNDAY').map((d) => ({
      dayOfWeek: d,
      blockIndex: 0,
      startTime: '09:00',
      endTime: '19:00',
    }));
  } finally {
    scheduleLoading.value = false;
  }
}

function closeSchedule() {
  scheduleEmployeeId.value = null;
}

function blocksForDay(day: string) {
  return scheduleBlocks.value
    .filter((b) => b.dayOfWeek === day)
    .sort((a, b) => a.blockIndex - b.blockIndex);
}

function isDayActive(day: string) {
  return scheduleBlocks.value.some((b) => b.dayOfWeek === day);
}

function toggleDay(day: string) {
  if (isDayActive(day)) {
    scheduleBlocks.value = scheduleBlocks.value.filter((b) => b.dayOfWeek !== day);
  } else {
    scheduleBlocks.value.push({ dayOfWeek: day, blockIndex: 0, startTime: '09:00', endTime: '19:00' });
  }
}

function addBlock(day: string) {
  const existing = blocksForDay(day);
  if (existing.length >= 3) return;
  const lastBlock = existing[existing.length - 1];
  scheduleBlocks.value.push({
    dayOfWeek: day,
    blockIndex: existing.length,
    startTime: lastBlock ? lastBlock.endTime : '14:00',
    endTime: '19:00',
  });
}

function removeBlock(day: string, blockIndex: number) {
  scheduleBlocks.value = scheduleBlocks.value.filter(
    (b) => !(b.dayOfWeek === day && b.blockIndex === blockIndex),
  );
  // Re-index
  let idx = 0;
  for (const b of scheduleBlocks.value.filter((b) => b.dayOfWeek === day).sort((a, c) => a.blockIndex - c.blockIndex)) {
    b.blockIndex = idx++;
  }
}

async function saveSchedule() {
  if (!scheduleEmployeeId.value) return;
  scheduleSaving.value = true;
  try {
    await api.put('/schedules/bulk', {
      employeeId: scheduleEmployeeId.value,
      days: scheduleBlocks.value.map((b) => ({
        dayOfWeek: b.dayOfWeek,
        blockIndex: b.blockIndex,
        startTime: b.startTime,
        endTime: b.endTime,
      })),
    });
    closeSchedule();
  } finally {
    scheduleSaving.value = false;
  }
}
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <!-- Top bar -->
    <header
      class="flex items-center gap-4 px-6 h-16 bg-white/80 backdrop-blur-md border-b border-[var(--color-outline-variant)]/10 sticky top-0 z-40 shrink-0"
    >
      <h1 class="text-lg font-bold tracking-tight">Personal</h1>
    </header>

    <!-- Content -->
    <div class="flex-1 overflow-y-auto p-6 lg:p-8">
      <div class="max-w-5xl mx-auto w-full">
        <!-- Breadcrumbs -->
        <nav
          class="flex items-center gap-2 text-sm text-[var(--color-on-surface-variant)] mb-6 font-medium"
        >
          <NuxtLink to="/admin" class="hover:text-[var(--color-primary)] transition-colors">
            Panel
          </NuxtLink>
          <span class="material-symbols-outlined text-xs">chevron_right</span>
          <span class="text-[var(--color-on-surface)]">Personal</span>
        </nav>

        <!-- Header -->
        <div class="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div class="space-y-1">
            <h2
              class="text-3xl lg:text-4xl font-extrabold tracking-tight text-[var(--color-on-surface)]"
            >
              Tu Equipo
            </h2>
            <p class="text-[var(--color-on-surface-variant)] max-w-xl">
              Administra a los colaboradores de tu negocio y asigna los servicios que ofrece cada
              uno.
            </p>
          </div>
          <button
            class="inline-flex items-center justify-center gap-2 soul-gradient text-white px-6 py-3 rounded-lg font-bold shadow-sm hover:opacity-90 transition-all active:scale-95 shrink-0"
            @click="
              showForm = true;
              editingId = null;
              form.name = '';
              form.serviceIds = [];
            "
          >
            <span class="material-symbols-outlined text-lg">person_add</span>
            Nuevo Colaborador
          </button>
        </div>

        <!-- Add/Edit Form Modal -->
        <Teleport to="body">
          <Transition name="fade">
            <div
              v-if="showForm"
              class="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 backdrop-blur-sm p-6"
              @click.self="resetForm"
            >
              <div
                class="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl border border-[var(--color-outline-variant)]/10"
              >
                <div class="flex items-center justify-between mb-6">
                  <h3 class="text-xl font-bold text-[var(--color-on-surface)]">
                    {{ editingId ? 'Editar Colaborador' : 'Nuevo Colaborador' }}
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
                    <label
                      class="text-xs font-bold text-[var(--color-outline)] uppercase tracking-wider"
                    >
                      Nombre completo
                    </label>
                    <input
                      v-model="form.name"
                      type="text"
                      required
                      placeholder="Ej: María González"
                      class="w-full px-4 py-3 bg-[var(--color-surface-container-high)] border-none rounded-lg focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:bg-white transition-all outline-none"
                    />
                  </div>

                  <!-- Service assignment -->
                  <div v-if="services.length > 0" class="space-y-2">
                    <label
                      class="text-xs font-bold text-[var(--color-outline)] uppercase tracking-wider"
                    >
                      Servicios que ofrece
                    </label>
                    <div class="flex flex-wrap gap-2">
                      <button
                        v-for="svc in services"
                        :key="svc.id"
                        type="button"
                        class="px-3 py-1.5 rounded-lg text-sm font-medium border transition-all"
                        :class="
                          form.serviceIds.includes(svc.id)
                            ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]'
                            : 'bg-white text-[var(--color-on-surface-variant)] border-[var(--color-outline-variant)]/30 hover:border-[var(--color-primary)]/40'
                        "
                        @click="toggleService(svc.id)"
                      >
                        {{ svc.name }}
                      </button>
                    </div>
                    <p class="text-xs text-[var(--color-on-surface-variant)]">
                      Selecciona los servicios que este colaborador puede realizar
                    </p>
                  </div>

                  <div class="flex gap-3 pt-2">
                    <button
                      type="submit"
                      class="flex-1 py-3 soul-gradient text-white font-bold rounded-lg hover:opacity-90 transition-all active:scale-[0.98]"
                    >
                      {{ editingId ? 'Guardar cambios' : 'Agregar colaborador' }}
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

        <!-- Schedule Editor Modal -->
        <Teleport to="body">
          <Transition name="fade">
            <div
              v-if="scheduleEmployeeId"
              class="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 backdrop-blur-sm p-4"
              @click.self="closeSchedule"
            >
              <div class="bg-white rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-2xl border border-[var(--color-outline-variant)]/10">
                <!-- Header -->
                <div class="flex items-center justify-between p-6 pb-4 border-b border-[var(--color-outline-variant)]/10">
                  <div>
                    <h3 class="text-lg font-bold text-[var(--color-on-surface)]">Horario de {{ scheduleEmployeeName }}</h3>
                    <p class="text-xs text-[var(--color-on-surface-variant)] mt-0.5">Configura los bloques de horario por día</p>
                  </div>
                  <button class="p-2 text-[var(--color-outline)] hover:text-[var(--color-on-surface)] rounded-lg hover:bg-[var(--color-surface-container-high)] transition-colors" @click="closeSchedule">
                    <span class="material-symbols-outlined">close</span>
                  </button>
                </div>

                <!-- Days list -->
                <div v-if="scheduleLoading" class="flex-1 flex items-center justify-center py-12">
                  <div class="w-6 h-6 border-2 border-[var(--color-primary)]/30 border-t-[var(--color-primary)] rounded-full animate-spin"></div>
                </div>
                <div v-else class="flex-1 overflow-y-auto p-6 space-y-3">
                  <div v-for="day in DAYS_ORDER" :key="day" class="rounded-xl border border-[var(--color-outline-variant)]/15 overflow-hidden">
                    <!-- Day header -->
                    <div class="flex items-center gap-3 px-4 py-3 bg-[var(--color-surface-container-low)]">
                      <button
                        class="w-5 h-5 rounded flex items-center justify-center border-2 transition-all shrink-0"
                        :class="isDayActive(day)
                          ? 'bg-[var(--color-primary)] border-[var(--color-primary)]'
                          : 'border-[var(--color-outline-variant)]/40 hover:border-[var(--color-primary)]/40'"
                        @click="toggleDay(day)"
                      >
                        <span v-if="isDayActive(day)" class="material-symbols-outlined text-white text-sm" style="font-variation-settings: 'wght' 600">check</span>
                      </button>
                      <span class="text-sm font-semibold" :class="isDayActive(day) ? 'text-[var(--color-on-surface)]' : 'text-[var(--color-outline)]'">
                        {{ DAY_LABELS[day] }}
                      </span>
                      <span v-if="!isDayActive(day)" class="text-xs text-[var(--color-outline)] ml-auto">Descanso</span>
                      <button
                        v-if="isDayActive(day) && blocksForDay(day).length < 3"
                        class="ml-auto p-1 text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 rounded transition-colors"
                        title="Agregar bloque"
                        @click="addBlock(day)"
                      >
                        <span class="material-symbols-outlined text-sm">add</span>
                      </button>
                    </div>

                    <!-- Time blocks -->
                    <div v-if="isDayActive(day)" class="px-4 py-3 space-y-2">
                      <div v-for="block in blocksForDay(day)" :key="block.blockIndex" class="flex items-center gap-2">
                        <input
                          v-model="block.startTime"
                          type="time"
                          class="flex-1 px-3 py-2 bg-[var(--color-surface-container-high)] border-none rounded-lg text-sm focus:ring-2 focus:ring-[var(--color-primary)]/20 outline-none"
                        />
                        <span class="text-xs text-[var(--color-outline)] font-medium">a</span>
                        <input
                          v-model="block.endTime"
                          type="time"
                          class="flex-1 px-3 py-2 bg-[var(--color-surface-container-high)] border-none rounded-lg text-sm focus:ring-2 focus:ring-[var(--color-primary)]/20 outline-none"
                        />
                        <button
                          v-if="blocksForDay(day).length > 1"
                          class="p-1 text-red-400 hover:bg-red-50 rounded transition-colors"
                          @click="removeBlock(day, block.blockIndex)"
                        >
                          <span class="material-symbols-outlined text-sm">close</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Footer -->
                <div class="p-6 pt-4 border-t border-[var(--color-outline-variant)]/10 flex gap-3">
                  <button
                    :disabled="scheduleSaving"
                    class="flex-1 py-3 soul-gradient text-white font-bold rounded-lg hover:opacity-90 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
                    @click="saveSchedule"
                  >
                    <span v-if="scheduleSaving" class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                    {{ scheduleSaving ? 'Guardando...' : 'Guardar horario' }}
                  </button>
                  <button
                    class="px-5 py-3 text-sm font-semibold text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface-container-high)] rounded-lg transition-colors"
                    @click="closeSchedule"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          </Transition>
        </Teleport>

        <!-- Loading skeleton -->
        <div v-if="loading" class="space-y-4">
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
        <div
          v-else-if="employees.length === 0"
          class="flex flex-col items-center justify-center py-24 text-center space-y-6"
        >
          <div
            class="w-32 h-32 bg-white rounded-full flex items-center justify-center shadow-sm border border-[var(--color-outline-variant)]/10"
          >
            <span class="material-symbols-outlined text-6xl text-[var(--color-outline-variant)]">
              group_off
            </span>
          </div>
          <div class="space-y-2">
            <h3 class="text-2xl font-bold text-[var(--color-on-surface)]">
              Aún no tienes colaboradores
            </h3>
            <p class="text-[var(--color-on-surface-variant)] max-w-sm mx-auto">
              Agrega a tu equipo para que tus clientes puedan elegir con quién agendar.
            </p>
          </div>
          <button
            class="soul-gradient text-white px-8 py-3 rounded-lg font-bold shadow-sm hover:opacity-90 transition-all active:scale-95"
            @click="showForm = true"
          >
            Agregar primer colaborador
          </button>
        </div>

        <!-- Employee list -->
        <div v-else class="space-y-3">
          <div
            v-for="(e, idx) in employees"
            :key="e.id"
            class="group flex items-center gap-5 p-5 bg-white rounded-xl shadow-sm border border-[var(--color-outline-variant)]/10 transition-all duration-200 hover:shadow-md hover:border-[var(--color-primary)]/20"
          >
            <!-- Avatar -->
            <div
              class="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0 ring-2 ring-offset-2"
              :class="[getAvatarColor(idx).bg, getAvatarColor(idx).ring]"
            >
              {{ getInitials(e.name) }}
            </div>

            <!-- Info -->
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-3 mb-1">
                <h3 class="font-bold text-[var(--color-on-surface)] truncate">{{ e.name }}</h3>
                <span
                  class="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full shrink-0"
                  :class="
                    e.isActive
                      ? 'text-emerald-700 bg-emerald-50 border border-emerald-100'
                      : 'text-slate-500 bg-slate-50 border border-slate-200'
                  "
                >
                  {{ e.isActive ? 'Activo' : 'Inactivo' }}
                </span>
              </div>
              <p
                v-if="e.serviceIds.length > 0"
                class="text-sm text-[var(--color-on-surface-variant)] truncate"
              >
                <span class="material-symbols-outlined text-sm align-middle mr-1">content_cut</span>
                {{ getServiceNames(e.serviceIds) }}
              </p>
              <p v-else class="text-sm text-[var(--color-outline)] italic">
                Sin servicios asignados
              </p>
            </div>

            <!-- Actions -->
            <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
              <button
                class="p-2 text-[var(--color-outline)] hover:bg-[var(--color-surface-container-high)] rounded-full transition-colors"
                title="Horario"
                @click="openSchedule(e)"
              >
                <span class="material-symbols-outlined text-lg">schedule</span>
              </button>
              <button
                class="p-2 text-[var(--color-outline)] hover:bg-[var(--color-surface-container-high)] rounded-full transition-colors"
                @click="startEdit(e)"
              >
                <span class="material-symbols-outlined text-lg">edit</span>
              </button>
              <button
                class="p-2 text-red-400 hover:bg-red-50 rounded-full transition-colors"
                @click="deleteEmployee(e.id)"
              >
                <span class="material-symbols-outlined text-lg">delete</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Stats -->
        <div v-if="employees.length > 0" class="mt-16 grid grid-cols-2 md:grid-cols-3 gap-4">
          <div
            class="p-5 bg-white rounded-xl shadow-sm border border-[var(--color-outline-variant)]/10"
          >
            <p
              class="text-[10px] font-bold uppercase tracking-widest text-[var(--color-outline)] mb-1"
            >
              Total Colaboradores
            </p>
            <p class="text-3xl font-black text-[var(--color-on-surface)]">
              {{ employees.length }}
            </p>
          </div>
          <div
            class="p-5 bg-white rounded-xl shadow-sm border border-[var(--color-outline-variant)]/10"
          >
            <p
              class="text-[10px] font-bold uppercase tracking-widest text-[var(--color-outline)] mb-1"
            >
              Activos
            </p>
            <p class="text-3xl font-black text-emerald-600">{{ activeCount }}</p>
          </div>
          <div
            class="p-5 bg-white rounded-xl shadow-sm border border-[var(--color-outline-variant)]/10"
          >
            <p
              class="text-[10px] font-bold uppercase tracking-widest text-[var(--color-outline)] mb-1"
            >
              Servicios Disponibles
            </p>
            <p class="text-3xl font-black text-[var(--color-primary)]">{{ services.length }}</p>
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
