<script setup lang="ts">
definePageMeta({ layout: false });

const currentStep = ref(1);
const totalSteps = 5;
const loading = ref(false);
const error = ref('');

const { store } = useAuth();
const onboarding = useOnboarding();

// ─── Step 1: Business Info ─────────────────────────
const businessForm = reactive({
  name: store.tenant?.name || '',
  slug: store.tenant?.slug || '',
});

// ─── Step 2: Services ──────────────────────────────
const services = reactive<Array<{ name: string; durationMinutes: number; priceMXN: number }>>([
  { name: '', durationMinutes: 45, priceMXN: 0 },
]);

function addService() {
  services.push({ name: '', durationMinutes: 30, priceMXN: 0 });
}

function removeService(index: number) {
  if (services.length > 1) services.splice(index, 1);
}

// ─── Step 3: Employees ─────────────────────────────
const createdServiceIds = ref<Array<{ id: string; name: string }>>([]);
const employees = reactive<Array<{ name: string; role: string; serviceIds: string[] }>>([
  { name: store.user?.name || '', role: 'Administrador', serviceIds: [] },
]);

function addEmployee() {
  employees.push({ name: '', role: 'Especialista', serviceIds: [] });
}

function removeEmployee(index: number) {
  if (employees.length > 1) employees.splice(index, 1);
}

// ─── Step 4: Schedule ──────────────────────────────
const weekDays = reactive([
  { name: 'Lunes', enabled: true, start: '09:00', end: '18:00' },
  { name: 'Martes', enabled: true, start: '09:00', end: '18:00' },
  { name: 'Miércoles', enabled: true, start: '09:00', end: '18:00' },
  { name: 'Jueves', enabled: true, start: '09:00', end: '18:00' },
  { name: 'Viernes', enabled: true, start: '09:00', end: '18:00' },
  { name: 'Sábado', enabled: false, start: '09:00', end: '18:00' },
  { name: 'Domingo', enabled: false, start: '09:00', end: '18:00' },
]);

// ─── Step 5: Done ───────────────────────────────────
const publicUrl = computed(() => {
  const slug = businessForm.slug || store.tenant?.slug || '';
  return slug ? `agendly.mx/${slug}` : '';
});

const ownerName = computed(() => store.user?.name?.split(' ')[0] || '');

// ─── Stepper ────────────────────────────────────────
const stepLabels = ['Negocio', 'Servicios', 'Equipo', 'Horarios'];

function stepState(step: number): 'completed' | 'active' | 'pending' {
  if (step < currentStep.value) return 'completed';
  if (step === currentStep.value) return 'active';
  return 'pending';
}

// ─── Navigation ─────────────────────────────────────
async function nextStep() {
  loading.value = true;
  error.value = '';

  try {
    if (currentStep.value === 1) {
      if (!businessForm.name || !businessForm.slug) {
        error.value = 'Completa todos los campos';
        loading.value = false;
        return;
      }
      await onboarding.updateTenant({
        name: businessForm.name,
        slug: businessForm.slug,
      });
    }

    if (currentStep.value === 2) {
      const validServices = services.filter((s) => s.name.trim());
      if (validServices.length === 0) {
        error.value = 'Agrega al menos un servicio';
        loading.value = false;
        return;
      }
      const created = await onboarding.createServices(
        validServices.map(({ name, durationMinutes, priceMXN }) => ({ name, durationMinutes, priceMXN }))
      );
      createdServiceIds.value = created.map((s: { id: string; name: string }) => ({ id: s.id, name: s.name }));
    }

    if (currentStep.value === 3) {
      const validEmployees = employees.filter((e) => e.name.trim());
      if (validEmployees.length === 0) {
        error.value = 'Agrega al menos un miembro del equipo';
        loading.value = false;
        return;
      }
      const created = await onboarding.createEmployees(
        validEmployees.map((e) => ({
          name: e.name,
          serviceIds: createdServiceIds.value.map((s) => s.id),
        }))
      );
      for (const emp of created) {
        await onboarding.createDefaultSchedule(emp.id);
      }
    }

    if (currentStep.value === 4) {
      await onboarding.completeOnboarding();
    }

    if (currentStep.value < totalSteps) {
      currentStep.value++;
    } else {
      navigateTo('/admin');
    }
  } catch (e: unknown) {
    const err = e as { data?: { message?: string } };
    error.value = err.data?.message || 'Ocurrió un error';
  } finally {
    loading.value = false;
  }
}

function prevStep() {
  if (currentStep.value > 1) {
    currentStep.value--;
  }
}

function copyUrl() {
  navigator.clipboard.writeText(`https://${publicUrl.value}`);
}
</script>

<template>
  <div class="min-h-screen bg-[var(--color-surface)] font-['Inter',sans-serif] text-[var(--color-on-surface)]">
    <!-- Sticky Header (hidden on success step) -->
    <header
      v-if="currentStep <= 4"
      class="w-full h-16 flex items-center justify-between px-6 md:px-8 bg-white/80 backdrop-blur-md sticky top-0 z-40 border-b border-[var(--color-outline-variant)]/10"
    >
      <div class="flex items-center gap-2">
        <span class="text-lg font-bold tracking-tight">Agendly</span>
        <span class="h-4 w-px bg-[var(--color-outline-variant)] mx-2 hidden sm:block"></span>
        <span class="text-sm font-medium text-[var(--color-on-surface-variant)] hidden sm:block">Configuración inicial</span>
      </div>
      <div class="text-sm font-medium text-[var(--color-outline)]">
        Paso {{ currentStep }} de 4
      </div>
    </header>

    <!-- Main Content (Steps 1-4) -->
    <main v-if="currentStep <= 4" class="flex-grow flex flex-col lg:flex-row">
      <!-- Form Section -->
      <section class="flex-grow flex flex-col items-center justify-start py-8 md:py-12 px-6 lg:px-20 overflow-y-auto">
        <!-- Stepper -->
        <div class="w-full max-w-xl mb-10">
          <div class="flex items-center justify-between relative">
            <!-- Line behind circles -->
            <div class="absolute top-5 left-0 w-full h-0.5 bg-[var(--color-surface-container-high)] -z-0"></div>
            <!-- Steps -->
            <div
              v-for="(label, i) in stepLabels"
              :key="i"
              class="flex flex-col items-center gap-2 relative z-10"
            >
              <!-- Completed -->
              <div
                v-if="stepState(i + 1) === 'completed'"
                class="w-10 h-10 rounded-full bg-[var(--color-primary)]/10 ring-2 ring-[var(--color-primary)] flex items-center justify-center"
              >
                <span class="material-symbols-outlined text-[var(--color-primary)] text-lg">check</span>
              </div>
              <!-- Active -->
              <div
                v-else-if="stepState(i + 1) === 'active'"
                class="w-10 h-10 rounded-full bg-[var(--color-primary)] text-white flex items-center justify-center font-bold text-sm shadow-sm"
              >
                {{ i + 1 }}
              </div>
              <!-- Pending -->
              <div
                v-else
                class="w-10 h-10 rounded-full bg-[var(--color-surface-container-highest)] text-[var(--color-on-surface-variant)] flex items-center justify-center font-bold text-sm"
              >
                {{ i + 1 }}
              </div>
              <span
                class="text-xs font-medium"
                :class="stepState(i + 1) === 'active' ? 'text-[var(--color-primary)] font-semibold' : 'text-[var(--color-on-surface-variant)]'"
              >
                {{ label }}
              </span>
            </div>
          </div>
        </div>

        <!-- Error Alert -->
        <div v-if="error" class="w-full max-w-xl mb-6 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          {{ error }}
        </div>

        <!-- Step 1: Business Info -->
        <div v-if="currentStep === 1" class="w-full max-w-xl space-y-10">
          <div class="space-y-2">
            <h1 class="text-3xl font-semibold tracking-tight">Crea la identidad de tu espacio</h1>
            <p class="text-[var(--color-on-surface-variant)] leading-relaxed">
              Definamos cómo te encontrarán tus clientes y en qué horario trabajas.
            </p>
          </div>

          <div class="space-y-8">
            <div class="space-y-2">
              <label class="text-sm font-medium tracking-wide text-[var(--color-on-surface-variant)] uppercase" for="biz-name">
                Nombre del negocio
              </label>
              <input
                id="biz-name"
                v-model="businessForm.name"
                type="text"
                placeholder="Ej. Salón Calma"
                class="w-full px-4 py-3 bg-[var(--color-surface-container-high)] border-none rounded-lg focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:bg-[var(--color-surface-container-lowest)] transition-all placeholder:text-[var(--color-outline)]/50"
              />
            </div>

            <div class="space-y-2">
              <label class="text-sm font-medium tracking-wide text-[var(--color-on-surface-variant)] uppercase" for="biz-slug">
                Tu enlace personalizado
              </label>
              <div class="relative flex items-center">
                <span class="absolute left-4 text-[var(--color-on-surface-variant)] font-medium text-sm">agendly.mx/</span>
                <input
                  id="biz-slug"
                  v-model="businessForm.slug"
                  type="text"
                  placeholder="salon-calma"
                  class="w-full pl-[100px] pr-4 py-3 bg-[var(--color-surface-container-high)] border-none rounded-lg focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:bg-[var(--color-surface-container-lowest)] transition-all placeholder:text-[var(--color-outline)]/50"
                />
              </div>
              <p class="text-xs text-[var(--color-on-surface-variant)]">Solo letras minúsculas, números y guiones.</p>
            </div>
          </div>

          <!-- Actions -->
          <div class="pt-6 flex items-center justify-end">
            <button
              :disabled="loading"
              class="px-10 py-3 bg-[var(--color-primary)] text-white rounded-lg font-semibold shadow-lg shadow-[var(--color-primary)]/10 hover:bg-[var(--color-primary-container)] transition-all flex items-center gap-2 disabled:opacity-50"
              @click="nextStep"
            >
              {{ loading ? 'Guardando...' : 'Siguiente paso' }}
              <span class="material-symbols-outlined text-sm">arrow_forward</span>
            </button>
          </div>
        </div>

        <!-- Step 2: Services -->
        <div v-if="currentStep === 2" class="w-full max-w-xl space-y-10">
          <div class="space-y-2">
            <h1 class="text-3xl font-semibold tracking-tight">¿Qué servicios ofreces?</h1>
            <p class="text-[var(--color-on-surface-variant)] leading-relaxed">
              Agrega tus servicios principales. Podrás añadir más después.
            </p>
          </div>

          <div class="space-y-4">
            <div
              v-for="(service, i) in services"
              :key="i"
              class="bg-[var(--color-surface-container-low)] rounded-xl p-5 space-y-4"
            >
              <div class="space-y-2">
                <label class="text-xs font-medium text-[var(--color-on-surface-variant)] uppercase tracking-wider">
                  Nombre del servicio
                </label>
                <input
                  v-model="service.name"
                  type="text"
                  placeholder="Ej. Corte de cabello"
                  class="w-full px-4 py-3 bg-[var(--color-surface-container-high)] border-none rounded-lg focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:bg-[var(--color-surface-container-lowest)] transition-all placeholder:text-[var(--color-outline)]/50"
                />
              </div>
              <div class="grid grid-cols-2 gap-4">
                <div class="space-y-2">
                  <label class="text-xs font-medium text-[var(--color-on-surface-variant)] uppercase tracking-wider">
                    Duración
                  </label>
                  <select
                    v-model.number="service.durationMinutes"
                    class="w-full px-4 py-3 bg-[var(--color-surface-container-high)] border-none rounded-lg focus:ring-2 focus:ring-[var(--color-primary)]/20 transition-all appearance-none cursor-pointer"
                  >
                    <option :value="15">15 min</option>
                    <option :value="30">30 min</option>
                    <option :value="45">45 min</option>
                    <option :value="60">60 min</option>
                    <option :value="90">90 min</option>
                    <option :value="120">120 min</option>
                  </select>
                </div>
                <div class="space-y-2">
                  <label class="text-xs font-medium text-[var(--color-on-surface-variant)] uppercase tracking-wider">
                    Precio
                  </label>
                  <div class="relative">
                    <span class="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-on-surface-variant)] font-medium">$</span>
                    <input
                      v-model.number="service.priceMXN"
                      type="number"
                      min="0"
                      placeholder="0.00"
                      class="w-full pl-8 pr-4 py-3 bg-[var(--color-surface-container-high)] border-none rounded-lg focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:bg-[var(--color-surface-container-lowest)] transition-all placeholder:text-[var(--color-outline)]/50"
                    />
                  </div>
                </div>
              </div>
              <button
                v-if="services.length > 1"
                class="text-sm text-red-500 hover:text-red-700 flex items-center gap-1"
                @click="removeService(i)"
              >
                <span class="material-symbols-outlined text-sm">delete</span>
                Eliminar
              </button>
            </div>

            <!-- Add Service -->
            <button
              class="w-full py-3 border-2 border-dashed border-[var(--color-outline-variant)]/40 rounded-xl text-[var(--color-primary)] font-medium hover:border-[var(--color-primary)]/40 hover:bg-[var(--color-primary)]/5 transition-all flex items-center justify-center gap-2"
              @click="addService"
            >
              <span class="material-symbols-outlined">add_circle</span>
              Agregar otro servicio
            </button>
          </div>

          <!-- Tip -->
          <div class="bg-amber-50 border border-amber-200/50 rounded-xl p-4 flex gap-3">
            <span class="material-symbols-outlined text-amber-600 text-xl">lightbulb</span>
            <p class="text-sm text-amber-800">
              <strong>Dato:</strong> Los negocios con al menos 3 servicios configurados tienen un 60% más de reservas iniciales.
            </p>
          </div>

          <!-- Actions -->
          <div class="pt-6 flex items-center justify-between">
            <button
              class="px-6 py-3 text-sm font-semibold text-[var(--color-on-surface-variant)] hover:text-[var(--color-on-surface)] transition-colors"
              @click="prevStep"
            >
              Atrás
            </button>
            <button
              :disabled="loading"
              class="px-10 py-3 bg-[var(--color-primary)] text-white rounded-lg font-semibold shadow-lg shadow-[var(--color-primary)]/10 hover:bg-[var(--color-primary-container)] transition-all flex items-center gap-2 disabled:opacity-50"
              @click="nextStep"
            >
              {{ loading ? 'Guardando...' : 'Siguiente paso' }}
              <span class="material-symbols-outlined text-sm">arrow_forward</span>
            </button>
          </div>
        </div>

        <!-- Step 3: Team -->
        <div v-if="currentStep === 3" class="w-full max-w-xl space-y-10">
          <div class="space-y-2">
            <h1 class="text-3xl font-semibold tracking-tight">¿Quiénes forman tu equipo?</h1>
            <p class="text-[var(--color-on-surface-variant)] leading-relaxed">
              Si trabajas sola, solo confirmanos tu nombre. Podrás añadir más colaboradores después.
            </p>
          </div>

          <div class="space-y-4">
            <div
              v-for="(emp, i) in employees"
              :key="i"
              class="bg-[var(--color-surface-container-lowest)] rounded-xl p-5 editorial-shadow border border-[var(--color-outline-variant)]/10"
            >
              <div class="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                <div class="md:col-span-6 space-y-2">
                  <label class="text-xs font-medium text-[var(--color-on-surface-variant)] uppercase tracking-wider">
                    Nombre completo
                  </label>
                  <input
                    v-model="emp.name"
                    type="text"
                    placeholder="Nombre del colaborador"
                    class="w-full px-4 py-3 bg-[var(--color-surface-container-high)] border-none rounded-lg focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:bg-[var(--color-surface-container-lowest)] transition-all placeholder:text-[var(--color-outline)]/50"
                  />
                </div>
                <div class="md:col-span-5 space-y-2">
                  <label class="text-xs font-medium text-[var(--color-on-surface-variant)] uppercase tracking-wider">
                    Rol / Especialidad
                  </label>
                  <select
                    v-model="emp.role"
                    class="w-full px-4 py-3 bg-[var(--color-surface-container-high)] border-none rounded-lg focus:ring-2 focus:ring-[var(--color-primary)]/20 transition-all appearance-none cursor-pointer"
                  >
                    <option>Administrador</option>
                    <option>Especialista</option>
                    <option>Recepcionista</option>
                  </select>
                </div>
                <div class="md:col-span-1 flex justify-center">
                  <button
                    v-if="employees.length > 1"
                    class="p-2 text-[var(--color-outline)] hover:text-red-500 transition-colors"
                    @click="removeEmployee(i)"
                  >
                    <span class="material-symbols-outlined">delete</span>
                  </button>
                </div>
              </div>
            </div>

            <!-- Add Employee -->
            <button
              class="w-full py-3 border-2 border-dashed border-[var(--color-outline-variant)]/40 rounded-xl text-[var(--color-primary)] font-medium hover:border-[var(--color-primary)]/40 hover:bg-[var(--color-primary)]/5 transition-all flex items-center justify-center gap-2"
              @click="addEmployee"
            >
              <span class="material-symbols-outlined">add_circle</span>
              Agregar especialista
            </button>
          </div>

          <!-- Security note -->
          <div class="flex items-center gap-2 text-xs text-[var(--color-on-surface-variant)]">
            <span class="material-symbols-outlined text-sm">lock</span>
            Tus datos están seguros y cifrados.
          </div>

          <!-- Actions -->
          <div class="pt-6 flex items-center justify-between">
            <button
              class="px-6 py-3 text-sm font-semibold text-[var(--color-on-surface-variant)] hover:text-[var(--color-on-surface)] transition-colors"
              @click="prevStep"
            >
              Atrás
            </button>
            <button
              :disabled="loading"
              class="px-10 py-3 bg-[var(--color-primary)] text-white rounded-lg font-semibold shadow-lg shadow-[var(--color-primary)]/10 hover:bg-[var(--color-primary-container)] transition-all flex items-center gap-2 disabled:opacity-50"
              @click="nextStep"
            >
              {{ loading ? 'Guardando...' : 'Siguiente paso' }}
              <span class="material-symbols-outlined text-sm">arrow_forward</span>
            </button>
          </div>
        </div>

        <!-- Step 4: Schedule -->
        <div v-if="currentStep === 4" class="w-full max-w-2xl space-y-8">
          <!-- Progress bar -->
          <div class="flex flex-col gap-2">
            <div class="flex justify-between items-end">
              <span class="text-xs font-bold tracking-wider text-[var(--color-primary)] uppercase">Paso 4 de 4</span>
              <span class="text-xs font-medium text-[var(--color-on-surface-variant)]">Finalizando...</span>
            </div>
            <div class="h-1.5 w-full bg-[var(--color-surface-container-high)] rounded-full overflow-hidden">
              <div class="h-full bg-[var(--color-primary)] w-full transition-all duration-500"></div>
            </div>
          </div>

          <!-- Main Card -->
          <div class="bg-[var(--color-surface-container-lowest)] rounded-xl editorial-shadow p-8 md:p-10 flex flex-col gap-8">
            <header class="text-center space-y-2">
              <h1 class="text-2xl md:text-3xl font-bold tracking-tight leading-tight">Tus horarios de atención</h1>
              <p class="text-[var(--color-on-surface-variant)]">Define cuándo está abierto tu negocio para recibir citas.</p>
            </header>

            <!-- ROI Banner -->
            <div class="bg-[var(--color-primary)]/5 rounded-xl p-4 flex items-center gap-4 border border-[var(--color-primary)]/10">
              <div class="bg-[var(--color-primary-container)] text-white h-10 w-10 rounded-full flex items-center justify-center shrink-0">
                <span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 1">auto_awesome</span>
              </div>
              <p class="text-sm font-medium">
                ¡Listo! Recuperarás aprox. <span class="text-[var(--color-primary)] font-bold">4 horas por semana</span> con Agendly.
              </p>
            </div>

            <!-- Weekly Schedule -->
            <div class="space-y-4">
              <div
                v-for="(day, i) in weekDays"
                :key="i"
                class="flex flex-wrap md:flex-nowrap items-center justify-between p-4 rounded-xl gap-4"
                :class="day.enabled ? 'bg-[var(--color-surface-container-low)]' : 'bg-[var(--color-surface-container-low)]/50 opacity-80'"
              >
                <div class="flex items-center gap-4 min-w-[120px]">
                  <label class="relative inline-flex items-center cursor-pointer">
                    <input v-model="day.enabled" type="checkbox" class="sr-only peer" />
                    <div class="w-11 h-6 bg-[var(--color-outline-variant)] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--color-primary)]"></div>
                  </label>
                  <span class="font-semibold">{{ day.name }}</span>
                </div>
                <div v-if="day.enabled" class="flex items-center gap-3 flex-1 justify-end">
                  <input
                    v-model="day.start"
                    type="text"
                    class="bg-[var(--color-surface-container-lowest)] border-none rounded-lg py-2 px-3 text-sm w-24 text-center focus:ring-2 focus:ring-[var(--color-primary)] shadow-sm"
                  />
                  <span class="text-[var(--color-on-surface-variant)]">—</span>
                  <input
                    v-model="day.end"
                    type="text"
                    class="bg-[var(--color-surface-container-lowest)] border-none rounded-lg py-2 px-3 text-sm w-24 text-center focus:ring-2 focus:ring-[var(--color-primary)] shadow-sm"
                  />
                </div>
                <div v-else class="flex items-center gap-3 flex-1 justify-end italic text-[var(--color-on-surface-variant)] text-sm">
                  Cerrado para citas
                </div>
              </div>
            </div>

            <!-- Actions -->
            <footer class="flex flex-col md:flex-row gap-4 pt-4">
              <button
                class="flex-1 order-2 md:order-1 bg-[var(--color-surface-container-high)] py-4 px-8 rounded-full font-semibold hover:bg-[var(--color-surface-container-highest)] transition-all"
                @click="prevStep"
              >
                Atrás
              </button>
              <button
                :disabled="loading"
                class="flex-[2] order-1 md:order-2 bg-[var(--color-primary)] text-white py-4 px-8 rounded-full font-bold shadow-lg shadow-[var(--color-primary)]/20 transition-all hover:opacity-90 flex items-center justify-center gap-2 disabled:opacity-50"
                @click="nextStep"
              >
                {{ loading ? 'Finalizando...' : 'Finalizar configuración' }}
                <span class="material-symbols-outlined text-sm">arrow_forward</span>
              </button>
            </footer>
          </div>

          <p class="text-center text-xs text-[var(--color-on-surface-variant)] px-8">
            Podrás modificar estos horarios en cualquier momento desde la configuración de tu negocio. Agendly se sincronizará automáticamente.
          </p>
        </div>
      </section>

      <!-- Preview Sidebar (Steps 1-3 on desktop) -->
      <aside
        v-if="currentStep <= 3"
        class="hidden lg:flex w-[480px] bg-[var(--color-surface-container-low)] p-8 flex-col items-center justify-center border-l border-[var(--color-outline-variant)]/10"
      >
        <!-- Phone Preview (Steps 1-2) -->
        <div v-if="currentStep <= 2" class="w-full max-w-sm">
          <p class="text-[10px] font-bold text-center text-[var(--color-outline)] uppercase tracking-[0.2em] mb-6">
            Vista previa pública
          </p>
          <div class="bg-[var(--color-surface-container-lowest)] rounded-[2.5rem] p-4 shadow-2xl shadow-slate-200/50 aspect-[9/18.5] relative overflow-hidden flex flex-col ring-8 ring-slate-900/5">
            <div class="flex justify-between items-center px-6 pt-4 mb-8">
              <span class="text-xs font-bold">9:41</span>
              <div class="flex gap-1.5">
                <span class="w-4 h-4 rounded-full bg-slate-200"></span>
                <span class="w-4 h-4 rounded-full bg-slate-200"></span>
              </div>
            </div>
            <div class="flex-grow space-y-8 px-4">
              <div class="flex flex-col items-center space-y-4">
                <div class="w-20 h-20 rounded-full bg-[var(--color-surface-container-high)] flex items-center justify-center">
                  <span class="material-symbols-outlined text-4xl text-[var(--color-outline-variant)]">storefront</span>
                </div>
                <div class="text-center space-y-1">
                  <h2 class="text-xl font-bold tracking-tight">{{ businessForm.name || 'Tu Negocio' }}</h2>
                  <p class="text-sm text-[var(--color-on-surface-variant)]">{{ publicUrl || 'agendly.mx/tu-negocio' }}</p>
                </div>
              </div>
              <div class="space-y-6">
                <div class="space-y-3">
                  <div class="h-4 w-1/2 bg-[var(--color-surface-container-high)] rounded-full"></div>
                  <div class="grid grid-cols-2 gap-3">
                    <div class="h-24 rounded-xl bg-[var(--color-surface-container-high)] animate-pulse"></div>
                    <div class="h-24 rounded-xl bg-[var(--color-surface-container-high)] animate-pulse"></div>
                  </div>
                </div>
              </div>
            </div>
            <div class="p-4 mt-auto">
              <div class="h-14 w-full bg-slate-100 rounded-2xl flex items-center justify-center">
                <span class="text-sm font-bold text-slate-300">Agendar cita</span>
              </div>
            </div>
          </div>
          <div class="mt-8 bg-[var(--color-primary)]/5 rounded-xl p-4 flex gap-3">
            <span class="material-symbols-outlined text-[var(--color-primary)] text-xl">auto_awesome</span>
            <p class="text-xs text-[var(--color-primary)] font-medium leading-relaxed">
              Tus clientes podrán agendar directamente desde este enlace una vez que termines la configuración.
            </p>
          </div>
        </div>

        <!-- Team Visual (Step 3) -->
        <div v-if="currentStep === 3" class="w-full max-w-sm space-y-6">
          <div class="rounded-2xl overflow-hidden aspect-[4/5] bg-[var(--color-surface-container)] relative">
            <div class="absolute inset-0 soul-gradient opacity-80"></div>
            <div class="absolute inset-0 flex flex-col justify-end p-8">
              <div class="glass-panel p-6 rounded-xl border border-white/10">
                <div class="flex items-center gap-3 mb-3">
                  <span class="material-symbols-outlined text-[var(--color-primary)] text-2xl">group</span>
                  <h3 class="font-bold text-lg">El poder de tu equipo</h3>
                </div>
                <p class="text-sm text-[var(--color-on-surface-variant)] leading-relaxed">
                  Configurar a tu equipo correctamente permite que tus clientes elijan a su especialista favorito y optimiza tu calendario automáticamente.
                </p>
              </div>
            </div>
          </div>
          <div class="bg-amber-50 border border-amber-200/50 rounded-xl p-4 flex gap-3">
            <span class="material-symbols-outlined text-amber-600">lightbulb</span>
            <div>
              <p class="font-bold text-sm text-amber-900">Consejo Agendly</p>
              <p class="text-sm text-amber-800 leading-relaxed">
                "Asignar roles específicos te ayuda a filtrar servicios por persona en tu página de reservas."
              </p>
            </div>
          </div>
        </div>
      </aside>
    </main>

    <!-- Step 5: Success / Celebration -->
    <main v-if="currentStep === 5" class="max-w-4xl mx-auto px-4 py-8 md:py-16">
      <!-- Celebration Banner -->
      <div class="celebrate-gradient rounded-2xl p-8 md:p-12 mb-8 shadow-sm flex flex-col md:flex-row items-center gap-6 text-center md:text-left relative overflow-hidden">
        <div class="absolute top-0 right-0 p-4 opacity-10">
          <span class="material-symbols-outlined text-9xl">auto_awesome</span>
        </div>
        <div class="bg-white/20 p-4 rounded-full backdrop-blur-md">
          <span class="text-5xl md:text-6xl">🎉</span>
        </div>
        <div class="flex flex-col gap-1">
          <h1 class="text-3xl md:text-5xl font-black text-[#1c1c1c] tracking-tight">
            ¡Lo lograste{{ ownerName ? `, ${ownerName}` : '' }}!
          </h1>
          <p class="text-lg md:text-xl font-medium text-[#1c1c1c]/80">Tu salón ya tiene agenda profesional</p>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
        <!-- Main Actions -->
        <div class="md:col-span-7 space-y-6">
          <!-- Link Card -->
          <div class="bg-[var(--color-surface-container-lowest)] rounded-2xl p-8 border border-[var(--color-outline-variant)]/15 editorial-shadow flex flex-col gap-6">
            <div class="flex flex-col gap-2">
              <span class="text-sm font-bold uppercase tracking-widest text-[var(--color-on-surface-variant)]/70">
                Tu link de agenda
              </span>
              <div class="flex items-center justify-between bg-[var(--color-surface-container-low)] p-4 rounded-xl border border-[var(--color-outline-variant)]/20">
                <span class="font-mono text-[var(--color-primary)] font-semibold truncate">{{ publicUrl }}</span>
                <button
                  class="flex items-center gap-2 text-[var(--color-primary)] hover:bg-[var(--color-primary)]/5 px-3 py-1.5 rounded-lg transition-colors"
                  @click="copyUrl"
                >
                  <span class="material-symbols-outlined text-sm">content_copy</span>
                  <span class="text-sm font-bold">Copiar</span>
                </button>
              </div>
            </div>
            <div class="flex flex-col gap-3">
              <button class="bg-[var(--color-primary)] hover:bg-[var(--color-primary-container)] text-white font-bold py-4 px-6 rounded-full flex items-center justify-center gap-3 transition-all duration-200 shadow-md">
                <span class="material-symbols-outlined">share</span>
                Compartir en WhatsApp
              </button>
              <button
                class="bg-[var(--color-surface-container-high)] hover:bg-[var(--color-surface-container-highest)] font-semibold py-4 px-6 rounded-full flex items-center justify-center gap-2 transition-all duration-200"
                @click="navigateTo(`/${businessForm.slug || store.tenant?.slug}`)"
              >
                Prueba tu formulario como cliente
                <span class="material-symbols-outlined text-sm">arrow_forward</span>
              </button>
            </div>
          </div>

          <!-- Admin Preview -->
          <div class="bg-[var(--color-surface-container-low)] rounded-2xl p-6 border border-[var(--color-outline-variant)]/10">
            <div class="flex items-center justify-between mb-6">
              <div class="flex items-center gap-2">
                <span class="material-symbols-outlined text-amber-500" style="font-variation-settings: 'FILL' 1">calendar_today</span>
                <h3 class="font-bold">Hoy</h3>
              </div>
              <span class="text-xs font-bold text-[var(--color-on-surface-variant)] bg-[var(--color-surface-container-highest)] px-2 py-1 rounded-md uppercase">
                Modo Admin
              </span>
            </div>
            <div class="bg-[var(--color-surface-container-lowest)] rounded-xl p-4 flex items-center justify-between shadow-sm border border-[var(--color-outline-variant)]/10">
              <div class="flex items-center gap-4">
                <div class="w-2 h-2 rounded-full bg-amber-400 ring-4 ring-amber-100"></div>
                <div class="flex flex-col">
                  <span class="font-black">10:00</span>
                  <span class="text-sm text-[var(--color-on-surface-variant)]">Cita de prueba</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Side Visual -->
        <div class="md:col-span-5 space-y-6">
          <div class="rounded-2xl overflow-hidden aspect-[4/5] bg-[var(--color-surface-container-low)] relative group shadow-lg">
            <div class="absolute inset-0 soul-gradient opacity-60"></div>
            <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent flex flex-col justify-end p-8">
              <div class="bg-white/90 backdrop-blur-md p-4 rounded-xl shadow-xl border border-white/20">
                <div class="flex items-center gap-3 mb-2">
                  <div class="w-10 h-10 rounded-full bg-[var(--color-primary-container)] flex items-center justify-center text-white">
                    <span class="material-symbols-outlined">auto_awesome</span>
                  </div>
                  <div>
                    <p class="text-xs font-bold uppercase tracking-tight text-[var(--color-primary)]">Estado del salón</p>
                    <p class="font-bold">Listo para recibir citas</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="bg-amber-50 border border-amber-200/50 p-6 rounded-2xl flex gap-4">
            <span class="material-symbols-outlined text-amber-600 text-3xl">lightbulb</span>
            <div class="flex flex-col gap-1">
              <p class="font-bold text-amber-900">Tip de Agendly</p>
              <p class="text-sm text-amber-800 leading-relaxed">
                Coloca tu nuevo link en la biografía de Instagram para que tus clientes agenden 24/7.
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <footer class="mt-16 text-center">
        <p class="text-[var(--color-on-surface-variant)] text-sm mb-4">¿Necesitas ayuda para configurar algo más?</p>
        <div class="flex items-center justify-center gap-6">
          <button
            class="text-[var(--color-primary)] font-bold hover:underline flex items-center gap-1"
            @click="navigateTo('/admin')"
          >
            <span class="material-symbols-outlined text-sm">dashboard</span>
            Ir al panel de administración
          </button>
        </div>
      </footer>
    </main>

    <!-- Decorative Background Blurs -->
    <div class="fixed -bottom-32 -left-32 w-96 h-96 bg-[var(--color-primary)]/5 rounded-full blur-[100px] pointer-events-none -z-10"></div>
    <div class="fixed -top-32 -right-32 w-96 h-96 bg-[var(--color-secondary,#526070)]/5 rounded-full blur-[100px] pointer-events-none -z-10"></div>
  </div>
</template>
