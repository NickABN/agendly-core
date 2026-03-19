<script setup lang="ts">
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

// ─── Load all data ──────────────────────────
onMounted(async () => {
  await Promise.all([loadTenant(), loadServices(), loadEmployees()]);
});
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <header class="bg-white border-b px-4 py-3 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <NuxtLink to="/admin">
          <UButton variant="ghost" size="sm" icon="i-heroicons-arrow-left">Volver</UButton>
        </NuxtLink>
        <h1 class="text-lg font-semibold">Configuración</h1>
      </div>
    </header>

    <div class="p-4 max-w-3xl mx-auto">
      <!-- Tabs -->
      <div class="flex gap-2 mb-6">
        <UButton
          v-for="tab in [
            { key: 'business', label: 'Negocio' },
            { key: 'services', label: 'Servicios' },
            { key: 'employees', label: 'Equipo' },
          ]"
          :key="tab.key"
          :variant="activeTab === tab.key ? 'solid' : 'ghost'"
          size="sm"
          @click="activeTab = tab.key"
        >
          {{ tab.label }}
        </UButton>
      </div>

      <!-- Business tab -->
      <UCard v-if="activeTab === 'business'">
        <template #header>
          <h2 class="font-semibold">Datos del negocio</h2>
        </template>

        <form class="space-y-4" @submit.prevent="saveBusiness">
          <UAlert v-if="businessSuccess" color="success" title="Guardado correctamente" />

          <UFormField label="Nombre">
            <UInput v-model="businessForm.name" size="lg" />
          </UFormField>
          <UFormField label="URL pública">
            <UInput v-model="businessForm.slug" size="lg" />
          </UFormField>
          <UFormField label="Teléfono">
            <UInput v-model="businessForm.phone" size="lg" type="tel" />
          </UFormField>
          <UFormField label="Dirección">
            <UInput v-model="businessForm.address" size="lg" />
          </UFormField>

          <UButton type="submit" :loading="businessLoading">Guardar</UButton>
        </form>
      </UCard>

      <!-- Services tab -->
      <UCard v-if="activeTab === 'services'">
        <template #header>
          <h2 class="font-semibold">Servicios</h2>
        </template>

        <div class="space-y-3 mb-4">
          <div
            v-for="s in services"
            :key="s.id"
            class="flex items-center justify-between p-3 rounded-lg border"
          >
            <div>
              <span class="font-medium">{{ s.name }}</span>
              <span class="text-sm text-gray-500 ml-2">{{ s.durationMinutes }} min · ${{ s.priceMXN }}</span>
            </div>
            <UButton
              variant="ghost"
              color="error"
              icon="i-heroicons-trash"
              size="xs"
              @click="deleteService(s.id)"
            />
          </div>
        </div>

        <div class="flex gap-2">
          <UInput v-model="newService.name" placeholder="Nombre" class="flex-1" />
          <UInput v-model.number="newService.durationMinutes" type="number" placeholder="Min" class="w-20" />
          <UInput v-model.number="newService.priceMXN" type="number" placeholder="$" class="w-24" />
          <UButton @click="addService">Agregar</UButton>
        </div>
      </UCard>

      <!-- Employees tab -->
      <UCard v-if="activeTab === 'employees'">
        <template #header>
          <h2 class="font-semibold">Equipo</h2>
        </template>

        <div class="space-y-3 mb-4">
          <div
            v-for="e in employees"
            :key="e.id"
            class="flex items-center justify-between p-3 rounded-lg border"
          >
            <span class="font-medium">{{ e.name }}</span>
            <UButton
              variant="ghost"
              color="error"
              icon="i-heroicons-trash"
              size="xs"
              @click="deleteEmployee(e.id)"
            />
          </div>
        </div>

        <div class="flex gap-2">
          <UInput
            v-model="newEmployeeName"
            placeholder="Nombre del empleado"
            class="flex-1"
            @keyup.enter="addEmployee"
          />
          <UButton @click="addEmployee">Agregar</UButton>
        </div>
      </UCard>
    </div>
  </div>
</template>
