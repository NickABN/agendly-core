<script setup lang="ts">
import type { UpdateLocationDto, UpdateProfileDto } from '@agendly/shared';
import { isReservedSlug } from '@agendly/shared';
import { useProfileStore } from '~/stores/profile';

definePageMeta({ layout: 'admin' });

// Business settings are for OWNER / ADMIN only (same guard the old profile page had).
// Checked on mount (client only) so SSR never redirects before auth is loaded.
const authStore = useAuthStore();
onMounted(() => {
  const role = authStore.user?.role;
  if (role !== 'OWNER' && role !== 'ADMIN') {
    void navigateTo('/admin');
  }
});

type SettingsTab = 'general' | 'publica' | 'imagenes' | 'ubicacion';

const tabs: { id: SettingsTab; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'publica', label: 'Página pública' },
  { id: 'imagenes', label: 'Imágenes' },
  { id: 'ubicacion', label: 'Ubicación' },
];

const route = useRoute();
const router = useRouter();
const profileStore = useProfileStore();
const locationSaved = ref(false);

const {
  form: businessForm,
  saving: businessLoading,
  saved: businessSuccess,
  slugError,
  load,
  save: savePublicPage,
} = useTenantConfig();
const { bookingBaseLabel } = usePublicBookingUrl();
const { bookingUrl, bookingDisplayUrl } = usePublicBookingUrl();

const activeTab = computed<SettingsTab>(() => {
  const queryTab = route.query.tab;
  return tabs.some((tab) => tab.id === queryTab) ? (queryTab as SettingsTab) : 'general';
});
const publicUrl = computed(() => bookingDisplayUrl(businessForm.slug));
const locationInitialData = computed(() => ({
  address: profileStore.profileData?.address ?? null,
  latitude: profileStore.profileData?.latitude ?? null,
  longitude: profileStore.profileData?.longitude ?? null,
}));

onMounted(() => {
  void Promise.all([load(), profileStore.fetchProfile(), profileStore.fetchImageHistory()]);
});

function selectTab(tab: SettingsTab) {
  void router.replace({ query: { ...route.query, tab } });
}

async function onProfileSubmit(dto: UpdateProfileDto) {
  await profileStore.saveProfile(dto);
}

async function onLocationSubmit(dto: UpdateLocationDto) {
  locationSaved.value = false;
  await profileStore.saveLocation(dto);
  locationSaved.value = !profileStore.error;
}

async function copyPublicUrl() {
  const url = bookingUrl(businessForm.slug);
  if (!url) return;
  await navigator.clipboard.writeText(url);
}

function validatePublicSlug(): string | null {
  const slug = businessForm.slug.trim();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return 'El slug solo puede contener letras minúsculas, números y guiones';
  }
  if (isReservedSlug(slug)) return 'Este slug está reservado, elige otro';
  return null;
}

async function handlePublicPageSubmit() {
  const validationError = validatePublicSlug();
  if (validationError) {
    slugError.value = validationError;
    return;
  }
  businessForm.slug = businessForm.slug.trim();
  await savePublicPage();
}
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">
    <header
      class="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-4 border-b border-[var(--color-outline-variant)]/10 bg-white/80 px-4 backdrop-blur-md sm:px-6"
    >
      <NuxtLink
        to="/admin"
        aria-label="Volver al panel"
        class="p-2 text-[var(--color-on-surface-variant)] transition-colors hover:text-[var(--color-on-surface)]"
      >
        <span class="material-symbols-outlined" aria-hidden="true">arrow_back</span>
      </NuxtLink>
      <h1 class="text-lg font-bold tracking-tight">Configuración</h1>
    </header>

    <main class="flex-1 overflow-y-auto p-4 sm:p-6">
      <div class="mx-auto w-full max-w-3xl space-y-6">
        <div>
          <h2 class="mb-1 text-2xl font-bold">Configuración del negocio</h2>
          <p class="text-sm text-[var(--color-on-surface-variant)]">
            Gestiona la información, página pública, imágenes y ubicación de tu negocio.
          </p>
        </div>

        <div
          v-if="profileStore.error"
          class="flex items-center gap-3 rounded-xl border border-red-100 bg-red-50 p-4"
          role="alert"
        >
          <span class="material-symbols-outlined shrink-0 text-red-600" aria-hidden="true"
            >error</span
          >
          <p class="text-sm text-red-700">{{ profileStore.error }}</p>
        </div>

        <div
          v-if="businessSuccess"
          class="flex items-center gap-3 rounded-xl border border-emerald-100 bg-emerald-50 p-4"
          role="status"
        >
          <span class="material-symbols-outlined text-emerald-600" aria-hidden="true"
            >check_circle</span
          >
          <p class="text-sm font-semibold text-emerald-700">Cambios guardados correctamente.</p>
        </div>

        <nav
          class="flex gap-1 overflow-x-auto rounded-xl bg-[var(--color-surface-container-low)] p-1"
          role="tablist"
          aria-label="Secciones de configuración"
        >
          <button
            v-for="tab in tabs"
            :key="tab.id"
            type="button"
            role="tab"
            :aria-selected="activeTab === tab.id"
            :tabindex="activeTab === tab.id ? 0 : -1"
            class="min-w-max flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition-all"
            :class="
              activeTab === tab.id
                ? 'bg-white text-[var(--color-primary)] shadow-sm'
                : 'text-[var(--color-on-surface-variant)] hover:text-[var(--color-on-surface)]'
            "
            @click="selectTab(tab.id)"
          >
            {{ tab.label }}
          </button>
        </nav>

        <section
          v-show="activeTab === 'general'"
          class="rounded-xl border border-[var(--color-outline-variant)]/10 bg-[var(--color-surface-container-lowest)] p-4 sm:p-6"
          role="tabpanel"
          aria-label="General"
        >
          <ProfileForm
            :initial-data="profileStore.profileData ?? undefined"
            @submit="onProfileSubmit"
          />
        </section>

        <section
          v-show="activeTab === 'publica'"
          class="space-y-6 rounded-xl border border-[var(--color-outline-variant)]/10 bg-[var(--color-surface-container-lowest)] p-4 sm:p-6"
          role="tabpanel"
          aria-label="Página pública"
        >
          <div class="space-y-2">
            <label
              for="business-slug"
              class="block text-xs font-medium uppercase tracking-wider text-[var(--color-on-surface-variant)]"
            >
              URL pública del negocio
            </label>
            <div
              class="flex items-center rounded-lg bg-[var(--color-surface-container-high)] focus-within:ring-2 focus-within:ring-[var(--color-primary)]/20"
            >
              <span class="whitespace-nowrap px-4 text-sm text-[var(--color-on-surface-variant)]">
                {{ bookingBaseLabel }}
              </span>
              <input
                id="business-slug"
                v-model="businessForm.slug"
                type="text"
                maxlength="60"
                autocomplete="off"
                :aria-invalid="Boolean(slugError)"
                class="w-full min-w-0 rounded-r-lg bg-transparent py-3 pr-4 outline-none"
              />
            </div>
            <p v-if="slugError" class="text-xs text-red-600" role="alert">{{ slugError }}</p>
          </div>

          <div class="space-y-2">
            <p
              class="text-xs font-medium uppercase tracking-wider text-[var(--color-on-surface-variant)]"
            >
              Vista previa
            </p>
            <div class="flex flex-wrap items-center gap-3">
              <a
                v-if="publicUrl"
                :href="bookingUrl(businessForm.slug)"
                target="_blank"
                rel="noopener noreferrer"
                class="break-all text-sm font-semibold text-[var(--color-primary)] underline"
              >
                {{ publicUrl }}
              </a>
              <p v-else class="text-sm text-[var(--color-on-surface-variant)]">
                Agrega un slug para ver la URL pública.
              </p>
              <button
                type="button"
                :disabled="!publicUrl"
                class="rounded-lg bg-[var(--color-surface-container-high)] px-3 py-2 text-sm font-semibold disabled:opacity-50"
                @click="copyPublicUrl"
              >
                Copiar enlace
              </button>
            </div>
          </div>

          <div class="flex items-start gap-3">
            <input
              id="listed-in-directory"
              v-model="businessForm.listedInDirectory"
              type="checkbox"
              aria-describedby="listed-in-directory-help"
              class="mt-1 size-4 accent-[var(--color-primary)]"
            />
            <div class="space-y-1">
              <label for="listed-in-directory" class="font-medium text-[var(--color-on-surface)]">
                Mostrar mi negocio en el directorio público de Agendly
              </label>
              <p
                id="listed-in-directory-help"
                class="text-sm text-[var(--color-on-surface-variant)]"
              >
                Tus clientes podrán encontrarte en la sección Negocios de Agendly. Puedes quitarlo
                cuando quieras.
              </p>
            </div>
          </div>

          <button
            type="button"
            :disabled="businessLoading"
            class="rounded-lg bg-[var(--color-primary)] px-6 py-3 font-semibold text-white transition-colors hover:bg-[var(--color-primary-container)] disabled:opacity-50"
            @click="handlePublicPageSubmit"
          >
            {{ businessLoading ? 'Guardando…' : 'Guardar cambios' }}
          </button>
        </section>

        <section
          v-show="activeTab === 'imagenes'"
          class="space-y-6"
          role="tabpanel"
          aria-label="Imágenes"
        >
          <div
            class="space-y-4 rounded-xl border border-[var(--color-outline-variant)]/10 bg-[var(--color-surface-container-lowest)] p-4 sm:p-6"
          >
            <h3 class="text-sm font-bold uppercase tracking-wider text-[var(--color-outline)]">
              Logo del negocio
            </h3>
            <ProfileImageUpload
              type="logo"
              :current-url="profileStore.profileData?.logoUrl ?? null"
              :max-size-mb="5"
            />
            <div class="pt-2">
              <p
                class="mb-3 text-xs font-medium uppercase tracking-wider text-[var(--color-on-surface-variant)]"
              >
                Historial de logos
              </p>
              <ProfileImageHistory :images="profileStore.imageHistory" type="LOGO" />
            </div>
          </div>

          <div
            class="space-y-4 rounded-xl border border-[var(--color-outline-variant)]/10 bg-[var(--color-surface-container-lowest)] p-4 sm:p-6"
          >
            <h3 class="text-sm font-bold uppercase tracking-wider text-[var(--color-outline)]">
              Banner del negocio
            </h3>
            <ProfileImageUpload
              type="banner"
              :current-url="profileStore.profileData?.bannerUrl ?? null"
              :max-size-mb="8"
            />
            <div class="pt-2">
              <p
                class="mb-3 text-xs font-medium uppercase tracking-wider text-[var(--color-on-surface-variant)]"
              >
                Historial de banners
              </p>
              <ProfileImageHistory :images="profileStore.imageHistory" type="BANNER" />
            </div>
          </div>
        </section>

        <section
          v-show="activeTab === 'ubicacion'"
          class="rounded-xl border border-[var(--color-outline-variant)]/10 bg-[var(--color-surface-container-lowest)] p-4 sm:p-6"
          role="tabpanel"
          aria-label="Ubicación"
        >
          <ProfileLocationForm
            :initial-data="locationInitialData"
            :saved="locationSaved"
            @submit="onLocationSubmit"
          />
        </section>
      </div>
    </main>
  </div>
</template>
