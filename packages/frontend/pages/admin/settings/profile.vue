<script setup lang="ts">
import type { UpdateProfileDto, UpdateLocationDto } from '@agendly/shared';
import { useProfileStore } from '~/stores/profile';
import { useAuthStore } from '~/stores/auth';

definePageMeta({ layout: 'admin' });

const store = useProfileStore();
const authStore = useAuthStore();

// ─── Role guard (OWNER / ADMIN only) ──────────────────────────────────────────
if (import.meta.client) {
  const role = authStore.user?.role;
  if (role !== 'OWNER' && role !== 'ADMIN') {
    await navigateTo('/admin');
  }
}

// ─── Tab state ─────────────────────────────────────────────────────────────────
type Tab = 'general' | 'imagenes' | 'ubicacion';
const activeTab = ref<Tab>('general');

const tabs: { id: Tab; label: string }[] = [
  { id: 'general', label: 'Información general' },
  { id: 'imagenes', label: 'Imágenes' },
  { id: 'ubicacion', label: 'Ubicación' },
];

// ─── Handlers ──────────────────────────────────────────────────────────────────
async function onProfileSubmit(dto: UpdateProfileDto) {
  await store.saveProfile(dto);
}

async function onLocationSubmit(dto: UpdateLocationDto) {
  await store.saveLocation(dto);
}

// ─── Computed helpers for component props ──────────────────────────────────────
const locationInitialData = computed(() => ({
  address: store.profileData?.address ?? null,
  latitude: store.profileData?.latitude ?? null,
  longitude: store.profileData?.longitude ?? null,
}));

// ─── Lifecycle ─────────────────────────────────────────────────────────────────
onMounted(async () => {
  await Promise.all([store.fetchProfile(), store.fetchImageHistory()]);
});
</script>

<template>
  <div class="flex flex-col">
    <!-- Top bar -->
    <header
      class="flex items-center gap-4 px-6 h-16 bg-white/80 backdrop-blur-md border-b border-[var(--color-outline-variant)]/10 sticky top-0 z-40 shrink-0"
    >
      <NuxtLink
        to="/admin"
        class="p-2 text-[var(--color-on-surface-variant)] hover:text-[var(--color-on-surface)] transition-colors"
        aria-label="Volver al panel"
      >
        <span class="material-symbols-outlined">arrow_back</span>
      </NuxtLink>
      <h1 class="text-lg font-bold tracking-tight">Perfil del negocio</h1>
    </header>

    <!-- Content -->
    <div class="p-4 sm:p-6">
      <div class="max-w-3xl mx-auto w-full space-y-6">

        <!-- Page heading -->
        <div>
          <h2 class="text-2xl font-bold mb-1">Personalización del perfil</h2>
          <p class="text-sm text-[var(--color-on-surface-variant)]">
            Gestiona la información, imágenes y ubicación de tu negocio.
          </p>
        </div>

        <!-- Global error banner -->
        <div
          v-if="store.error"
          class="flex items-center gap-3 p-4 rounded-xl bg-red-50 border border-red-100"
          role="alert"
        >
          <span class="material-symbols-outlined text-red-600 shrink-0">error</span>
          <p class="text-sm text-red-700">{{ store.error }}</p>
        </div>

        <!-- Loading skeleton -->
        <div v-if="store.loading && !store.profileData" class="flex items-center justify-center py-20 gap-3">
          <div
            class="w-5 h-5 border-2 border-[var(--color-surface-container-high)] border-t-[var(--color-primary)] rounded-full animate-spin"
          />
          <span class="text-sm text-[var(--color-on-surface-variant)]">Cargando perfil…</span>
        </div>

        <template v-else>
          <!-- Tab navigation -->
          <nav
            class="flex gap-1 p-1 bg-[var(--color-surface-container-low)] rounded-xl"
            aria-label="Secciones del perfil"
          >
            <button
              v-for="tab in tabs"
              :key="tab.id"
              class="flex-1 px-4 py-2 text-sm font-semibold rounded-lg transition-all"
              :class="
                activeTab === tab.id
                  ? 'bg-white shadow-sm text-[var(--color-primary)]'
                  : 'text-[var(--color-on-surface-variant)] hover:text-[var(--color-on-surface)]'
              "
              :aria-selected="activeTab === tab.id"
              role="tab"
              @click="activeTab = tab.id"
            >
              {{ tab.label }}
            </button>
          </nav>

          <!-- ── Tab: Información general ── -->
          <section
            v-show="activeTab === 'general'"
            class="bg-[var(--color-surface-container-lowest)] rounded-xl p-6 border border-[var(--color-outline-variant)]/10"
            aria-labelledby="tab-general-heading"
          >
            <h3
              id="tab-general-heading"
              class="text-sm font-bold text-[var(--color-outline)] uppercase tracking-wider mb-6"
            >
              Información general
            </h3>
            <ProfileForm
              :initial-data="store.profileData ?? undefined"
              @submit="onProfileSubmit"
            />
          </section>

          <!-- ── Tab: Imágenes ── -->
          <section
            v-show="activeTab === 'imagenes'"
            class="space-y-8"
            aria-labelledby="tab-imagenes-heading"
          >
            <h3 id="tab-imagenes-heading" class="sr-only">Imágenes</h3>

            <!-- Logo -->
            <div
              class="bg-[var(--color-surface-container-lowest)] rounded-xl p-6 border border-[var(--color-outline-variant)]/10 space-y-4"
            >
              <h4 class="text-sm font-bold text-[var(--color-outline)] uppercase tracking-wider">
                Logo del negocio
              </h4>
              <ImageUpload
                type="logo"
                :current-url="store.profileData?.logoUrl ?? null"
                :max-size-mb="5"
              />
              <div class="pt-2">
                <p class="text-xs font-medium text-[var(--color-on-surface-variant)] uppercase tracking-wider mb-3">
                  Historial de logos
                </p>
                <ImageHistory :images="store.imageHistory" type="LOGO" />
              </div>
            </div>

            <!-- Banner -->
            <div
              class="bg-[var(--color-surface-container-lowest)] rounded-xl p-6 border border-[var(--color-outline-variant)]/10 space-y-4"
            >
              <h4 class="text-sm font-bold text-[var(--color-outline)] uppercase tracking-wider">
                Banner del negocio
              </h4>
              <ImageUpload
                type="banner"
                :current-url="store.profileData?.bannerUrl ?? null"
                :max-size-mb="8"
              />
              <div class="pt-2">
                <p class="text-xs font-medium text-[var(--color-on-surface-variant)] uppercase tracking-wider mb-3">
                  Historial de banners
                </p>
                <ImageHistory :images="store.imageHistory" type="BANNER" />
              </div>
            </div>
          </section>

          <!-- ── Tab: Ubicación ── -->
          <section
            v-show="activeTab === 'ubicacion'"
            class="bg-[var(--color-surface-container-lowest)] rounded-xl p-6 border border-[var(--color-outline-variant)]/10"
            aria-labelledby="tab-ubicacion-heading"
          >
            <h3
              id="tab-ubicacion-heading"
              class="text-sm font-bold text-[var(--color-outline)] uppercase tracking-wider mb-6"
            >
              Ubicación
            </h3>
            <LocationForm
              :initial-data="locationInitialData"
              @submit="onLocationSubmit"
            />
          </section>
        </template>

      </div>
    </div>
  </div>
</template>
