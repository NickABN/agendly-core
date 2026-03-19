<script setup lang="ts">
definePageMeta({ layout: 'auth' });

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
const suggestedServices = [
  { name: 'Corte de cabello', durationMinutes: 45, priceMXN: 250 },
  { name: 'Tinte', durationMinutes: 90, priceMXN: 800 },
  { name: 'Manicure', durationMinutes: 40, priceMXN: 200 },
  { name: 'Pedicure', durationMinutes: 50, priceMXN: 250 },
  { name: 'Uñas acrílicas', durationMinutes: 90, priceMXN: 500 },
  { name: 'Alisado', durationMinutes: 120, priceMXN: 1500 },
  { name: 'Maquillaje', durationMinutes: 60, priceMXN: 600 },
  { name: 'Depilación', durationMinutes: 30, priceMXN: 150 },
];

const services = reactive<Array<{ name: string; durationMinutes: number; priceMXN: number; selected: boolean }>>([
  ...suggestedServices.map((s) => ({ ...s, selected: false })),
]);

const customService = reactive({ name: '', durationMinutes: 30, priceMXN: 0 });

function addCustomService() {
  if (!customService.name) return;
  services.push({
    name: customService.name,
    durationMinutes: customService.durationMinutes,
    priceMXN: customService.priceMXN,
    selected: true,
  });
  customService.name = '';
  customService.durationMinutes = 30;
  customService.priceMXN = 0;
}

// ─── Step 3: Employees ─────────────────────────────
const createdServiceIds = ref<Array<{ id: string; name: string }>>([]);
const employees = reactive<Array<{ name: string; serviceIds: string[] }>>([]);
const newEmployeeName = ref('');

function addEmployee() {
  if (!newEmployeeName.value) return;
  employees.push({
    name: newEmployeeName.value,
    serviceIds: createdServiceIds.value.map((s) => s.id), // All services by default
  });
  newEmployeeName.value = '';
}

function removeEmployee(index: number) {
  employees.splice(index, 1);
}

// ─── Step 4: Schedule confirmation ──────────────────
const scheduleConfirmed = ref(false);

// ─── Step 5: Done ───────────────────────────────────
const publicUrl = computed(() => {
  const slug = businessForm.slug || store.tenant?.slug || '';
  return slug ? `agendly.mx/${slug}` : '';
});

// ─── Navigation ─────────────────────────────────────
async function nextStep() {
  loading.value = true;
  error.value = '';

  try {
    if (currentStep.value === 1) {
      await onboarding.updateTenant({
        name: businessForm.name,
        slug: businessForm.slug,
      });
    }

    if (currentStep.value === 2) {
      const selectedServices = services
        .filter((s) => s.selected)
        .map(({ name, durationMinutes, priceMXN }) => ({ name, durationMinutes, priceMXN }));

      if (selectedServices.length === 0) {
        error.value = 'Agrega al menos un servicio';
        loading.value = false;
        return;
      }

      const created = await onboarding.createServices(selectedServices);
      createdServiceIds.value = created.map((s) => ({ id: s.id, name: s.name }));
    }

    if (currentStep.value === 3) {
      if (employees.length === 0) {
        error.value = 'Agrega al menos un empleado';
        loading.value = false;
        return;
      }

      const created = await onboarding.createEmployees(employees);
      // Create default schedule for each employee
      for (const emp of created) {
        await onboarding.createDefaultSchedule(emp.id);
      }
    }

    if (currentStep.value === 4) {
      // Schedule confirmed, complete onboarding
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
</script>

<template>
  <div class="w-full max-w-lg mx-auto">
    <!-- Progress bar -->
    <div class="mb-6">
      <div class="flex justify-between text-xs text-gray-500 mb-1">
        <span>Paso {{ currentStep }} de {{ totalSteps }}</span>
      </div>
      <div class="h-2 bg-gray-200 rounded-full">
        <div
          class="h-2 bg-primary rounded-full transition-all"
          :style="{ width: `${(currentStep / totalSteps) * 100}%` }"
        />
      </div>
    </div>

    <UAlert v-if="error" color="error" :title="error" class="mb-4" />

    <!-- Step 1: Business Info -->
    <UCard v-if="currentStep === 1">
      <template #header>
        <h2 class="text-lg font-semibold">Datos de tu negocio</h2>
        <p class="text-sm text-gray-500">Personaliza cómo aparecerá tu negocio</p>
      </template>

      <div class="space-y-4">
        <UFormField label="Nombre del negocio">
          <UInput
            v-model="businessForm.name"
            placeholder="Ej: Bellas Nails"
            size="lg"
          />
        </UFormField>

        <UFormField label="URL pública" hint="Solo letras, números y guiones">
          <UInput
            v-model="businessForm.slug"
            placeholder="bellas-nails"
            size="lg"
          >
            <template #leading>
              <span class="text-gray-400 text-sm">agendly.mx/</span>
            </template>
          </UInput>
        </UFormField>
      </div>

      <template #footer>
        <div class="flex justify-end">
          <UButton size="lg" :loading="loading" @click="nextStep">
            Siguiente
          </UButton>
        </div>
      </template>
    </UCard>

    <!-- Step 2: Services -->
    <UCard v-if="currentStep === 2">
      <template #header>
        <h2 class="text-lg font-semibold">¿Qué servicios ofreces?</h2>
        <p class="text-sm text-gray-500">Selecciona o agrega tus servicios</p>
      </template>

      <div class="space-y-3 max-h-64 overflow-y-auto">
        <label
          v-for="(service, i) in services"
          :key="i"
          class="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-gray-50 transition"
          :class="service.selected ? 'border-primary bg-primary/5' : 'border-gray-200'"
        >
          <input
            v-model="service.selected"
            type="checkbox"
            class="accent-primary"
          />
          <div class="flex-1">
            <span class="font-medium">{{ service.name }}</span>
            <span class="text-sm text-gray-500 ml-2">{{ service.durationMinutes }} min</span>
          </div>
          <span class="text-sm font-medium">${{ service.priceMXN }}</span>
        </label>
      </div>

      <div class="mt-4 pt-4 border-t space-y-3">
        <p class="text-sm font-medium text-gray-700">Agregar servicio personalizado</p>
        <div class="flex gap-2">
          <UInput v-model="customService.name" placeholder="Nombre" class="flex-1" />
          <UInput v-model.number="customService.durationMinutes" type="number" placeholder="Min" class="w-20" />
          <UInput v-model.number="customService.priceMXN" type="number" placeholder="$" class="w-24" />
          <UButton variant="outline" icon="i-heroicons-plus" @click="addCustomService" />
        </div>
      </div>

      <template #footer>
        <div class="flex justify-between">
          <UButton variant="ghost" size="lg" @click="prevStep">Atrás</UButton>
          <UButton size="lg" :loading="loading" @click="nextStep">
            Siguiente
          </UButton>
        </div>
      </template>
    </UCard>

    <!-- Step 3: Employees -->
    <UCard v-if="currentStep === 3">
      <template #header>
        <h2 class="text-lg font-semibold">¿Quiénes atienden?</h2>
        <p class="text-sm text-gray-500">Agrega a tu equipo de trabajo</p>
      </template>

      <div class="space-y-3">
        <div
          v-for="(emp, i) in employees"
          :key="i"
          class="flex items-center justify-between p-3 rounded-lg border border-gray-200"
        >
          <div>
            <span class="font-medium">{{ emp.name }}</span>
            <span class="text-xs text-gray-500 ml-2">
              {{ emp.serviceIds.length }} servicio(s)
            </span>
          </div>
          <UButton
            variant="ghost"
            color="error"
            icon="i-heroicons-trash"
            size="xs"
            @click="removeEmployee(i)"
          />
        </div>
      </div>

      <div class="mt-4 flex gap-2">
        <UInput
          v-model="newEmployeeName"
          placeholder="Nombre del empleado"
          size="lg"
          class="flex-1"
          @keyup.enter="addEmployee"
        />
        <UButton variant="outline" size="lg" @click="addEmployee">
          Agregar
        </UButton>
      </div>

      <template #footer>
        <div class="flex justify-between">
          <UButton variant="ghost" size="lg" @click="prevStep">Atrás</UButton>
          <UButton size="lg" :loading="loading" @click="nextStep">
            Siguiente
          </UButton>
        </div>
      </template>
    </UCard>

    <!-- Step 4: Schedule -->
    <UCard v-if="currentStep === 4">
      <template #header>
        <h2 class="text-lg font-semibold">Horario de atención</h2>
        <p class="text-sm text-gray-500">Se asignará un horario predeterminado a todos tus empleados</p>
      </template>

      <div class="space-y-3">
        <div class="p-4 rounded-lg bg-gray-50 space-y-2">
          <div
            v-for="day in ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']"
            :key="day"
            class="flex justify-between text-sm"
          >
            <span class="font-medium">{{ day }}</span>
            <span class="text-gray-600">9:00 AM — 7:00 PM</span>
          </div>
          <div class="flex justify-between text-sm">
            <span class="font-medium">Domingo</span>
            <span class="text-gray-400">Cerrado</span>
          </div>
        </div>

        <p class="text-xs text-gray-500">
          Podrás personalizar el horario de cada empleado después desde la configuración.
        </p>
      </div>

      <template #footer>
        <div class="flex justify-between">
          <UButton variant="ghost" size="lg" @click="prevStep">Atrás</UButton>
          <UButton size="lg" :loading="loading" @click="nextStep">
            Confirmar horario
          </UButton>
        </div>
      </template>
    </UCard>

    <!-- Step 5: Done -->
    <UCard v-if="currentStep === 5">
      <template #header>
        <div class="text-center">
          <div class="text-4xl mb-2">🎉</div>
          <h2 class="text-lg font-semibold">¡Tu negocio está listo!</h2>
          <p class="text-sm text-gray-500">Ya puedes recibir citas de tus clientes</p>
        </div>
      </template>

      <div class="space-y-4">
        <div class="p-4 rounded-lg bg-primary/5 border border-primary/20 text-center">
          <p class="text-sm text-gray-600 mb-1">Tu página de reservas</p>
          <p class="text-lg font-semibold text-primary">{{ publicUrl }}</p>
        </div>

        <p class="text-sm text-gray-500 text-center">
          Comparte este enlace con tus clientes para que puedan agendar citas en línea.
        </p>
      </div>

      <template #footer>
        <UButton block size="lg" @click="navigateTo('/admin')">
          Ir al panel de administración
        </UButton>
      </template>
    </UCard>
  </div>
</template>
