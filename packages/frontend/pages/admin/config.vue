<script setup lang="ts">
definePageMeta({ layout: 'admin' });

const api = useApi();

// ─── Business Info ──────────────────────────
interface TenantData {
  id: string;
  name: string;
  slug: string;
  phone: string | null;
  address: string | null;
  logoUrl: string | null;
  latitude: number | null;
  longitude: number | null;
  timezone: string;
}

const businessForm = reactive({
  name: '',
  slug: '',
  phone: '',
  address: '',
  latitude: null as number | null,
  longitude: null as number | null,
});
const businessLoading = ref(false);
const businessSuccess = ref(false);
const currentLogoUrl = ref<string | null>(null);

// ─── Logo Upload ──────────────────────────
const logoFile = ref<File | null>(null);
const logoPreview = ref<string | null>(null);
const logoUploading = ref(false);

function onLogoSelect(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  logoFile.value = file;
  logoPreview.value = URL.createObjectURL(file);
}

async function uploadLogo() {
  if (!logoFile.value) return;
  logoUploading.value = true;
  try {
    const formData = new FormData();
    formData.append('logo', logoFile.value);
    const result = await api.post<TenantData>('/tenant/logo', formData);
    currentLogoUrl.value = result.logoUrl;
    logoFile.value = null;
    logoPreview.value = null;
  } finally {
    logoUploading.value = false;
  }
}

// ─── Data Loading ──────────────────────────
async function loadTenant() {
  const tenant = await api.get<TenantData>('/tenant');
  businessForm.name = tenant.name;
  businessForm.slug = tenant.slug;
  businessForm.phone = tenant.phone || '';
  businessForm.address = tenant.address || '';
  businessForm.latitude = tenant.latitude;
  businessForm.longitude = tenant.longitude;
  currentLogoUrl.value = tenant.logoUrl;
}

async function saveBusiness() {
  businessLoading.value = true;
  businessSuccess.value = false;
  try {
    const payload: Record<string, unknown> = {
      name: businessForm.name,
      slug: businessForm.slug,
      phone: businessForm.phone,
      address: businessForm.address,
    };
    if (businessForm.latitude != null) payload.latitude = businessForm.latitude;
    if (businessForm.longitude != null) payload.longitude = businessForm.longitude;
    await api.patch('/tenant', payload);
    businessSuccess.value = true;
    setTimeout(() => (businessSuccess.value = false), 3000);
  } finally {
    businessLoading.value = false;
  }
}

const runtimeConfig = useRuntimeConfig();
const backendUrl = (runtimeConfig.public.apiUrl as string || 'http://localhost:3000').replace(/\/api$/, '');
const logoSrc = computed(() => {
  if (logoPreview.value) return logoPreview.value;
  if (currentLogoUrl.value) return `${backendUrl}${currentLogoUrl.value}`;
  return null;
});

const mapSrc = computed(() => {
  if (businessForm.latitude && businessForm.longitude) {
    return `https://maps.google.com/maps?q=${businessForm.latitude},${businessForm.longitude}&z=16&output=embed`;
  }
  if (businessForm.address) {
    return `https://maps.google.com/maps?q=${encodeURIComponent(businessForm.address)}&z=16&output=embed`;
  }
  return null;
});

onMounted(() => {
  loadTenant();
});
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
    <div class="flex-1 overflow-y-auto p-6 max-w-3xl mx-auto w-full">
      <div class="mb-8">
        <h2 class="text-2xl font-bold mb-1">Configuración del negocio</h2>
        <p class="text-sm text-[var(--color-on-surface-variant)]">Gestiona la identidad de tu negocio, logo y ubicación.</p>
      </div>

      <!-- Success banner -->
      <div v-if="businessSuccess" class="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 border border-emerald-100 mb-6">
        <span class="material-symbols-outlined text-emerald-600" style="font-variation-settings: 'FILL' 1">check_circle</span>
        <p class="text-sm font-semibold text-emerald-700">Cambios guardados correctamente.</p>
      </div>

      <!-- Logo Section -->
      <section class="mb-8 bg-[var(--color-surface-container-lowest)] rounded-xl p-6 editorial-shadow border border-[var(--color-outline-variant)]/10">
        <h3 class="text-sm font-bold text-[var(--color-outline)] uppercase tracking-wider mb-4">Logo del negocio</h3>
        <div class="flex items-center gap-6">
          <!-- Logo preview -->
          <div class="w-24 h-24 rounded-xl bg-[var(--color-surface-container-high)] flex items-center justify-center overflow-hidden shrink-0 border-2 border-dashed border-[var(--color-outline-variant)]/30">
            <img v-if="logoSrc" :src="logoSrc" alt="Logo" class="w-full h-full object-cover" />
            <span v-else class="material-symbols-outlined text-3xl text-[var(--color-outline)]">storefront</span>
          </div>
          <div class="flex-1 space-y-3">
            <p class="text-sm text-[var(--color-on-surface-variant)]">
              Sube el logo de tu negocio. Máximo 2 MB, formato JPEG, PNG o WebP.
            </p>
            <div class="flex items-center gap-3">
              <label class="px-4 py-2 bg-[var(--color-surface-container-high)] rounded-lg text-sm font-semibold cursor-pointer hover:bg-[var(--color-surface-container-highest)] transition-colors">
                <span class="flex items-center gap-2">
                  <span class="material-symbols-outlined text-base">upload</span>
                  Seleccionar archivo
                </span>
                <input type="file" accept="image/jpeg,image/png,image/webp" class="hidden" @change="onLogoSelect" />
              </label>
              <button
                v-if="logoFile"
                :disabled="logoUploading"
                class="px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg text-sm font-semibold hover:bg-[var(--color-primary-container)] transition-colors disabled:opacity-50 flex items-center gap-2"
                @click="uploadLogo"
              >
                <span v-if="logoUploading" class="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                {{ logoUploading ? 'Subiendo...' : 'Subir logo' }}
              </button>
            </div>
          </div>
        </div>
      </section>

      <!-- Business Info Form -->
      <section class="mb-8 bg-[var(--color-surface-container-lowest)] rounded-xl p-6 editorial-shadow border border-[var(--color-outline-variant)]/10">
        <h3 class="text-sm font-bold text-[var(--color-outline)] uppercase tracking-wider mb-4">Información general</h3>
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

          <!-- Coordinates -->
          <div class="grid grid-cols-2 gap-4">
            <div class="space-y-2">
              <label class="text-xs font-bold text-[var(--color-outline)] uppercase tracking-wider">Latitud</label>
              <input
                v-model.number="businessForm.latitude"
                type="number"
                step="0.0000001"
                placeholder="19.4326077"
                class="w-full px-4 py-3 bg-[var(--color-surface-container-high)] border-none rounded-lg focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:bg-[var(--color-surface-container-lowest)] transition-all outline-none"
              />
            </div>
            <div class="space-y-2">
              <label class="text-xs font-bold text-[var(--color-outline)] uppercase tracking-wider">Longitud</label>
              <input
                v-model.number="businessForm.longitude"
                type="number"
                step="0.0000001"
                placeholder="-99.1332080"
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
          </div>
        </form>
      </section>

      <!-- Map Section -->
      <section class="mb-8 bg-[var(--color-surface-container-lowest)] rounded-xl p-6 editorial-shadow border border-[var(--color-outline-variant)]/10">
        <h3 class="text-sm font-bold text-[var(--color-outline)] uppercase tracking-wider mb-4">Ubicación en mapa</h3>
        <div v-if="mapSrc" class="rounded-lg overflow-hidden border border-[var(--color-outline-variant)]/20">
          <iframe
            :src="mapSrc"
            width="100%"
            height="300"
            style="border:0"
            allowfullscreen
            loading="lazy"
            referrerpolicy="no-referrer-when-downgrade"
          ></iframe>
        </div>
        <div v-else class="flex flex-col items-center justify-center py-12 text-center text-[var(--color-on-surface-variant)]">
          <span class="material-symbols-outlined text-4xl mb-2">map</span>
          <p class="text-sm">Ingresa coordenadas o una dirección para ver el mapa.</p>
        </div>
      </section>
    </div>
  </div>
</template>
