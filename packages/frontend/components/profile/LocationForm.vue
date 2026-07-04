<script setup lang="ts">
import type { UpdateLocationDto } from '@agendly/shared';
import { useProfileStore } from '~/stores/profile';

// ─── Props & emits ─────────────────────────────────────────────────────────────
const props = defineProps<{
  initialData?: {
    address: string | null;
    latitude: number | null;
    longitude: number | null;
  };
}>();

const emit = defineEmits<{
  submit: [dto: UpdateLocationDto];
}>();

// ─── Store ─────────────────────────────────────────────────────────────────────
const store = useProfileStore();

// ─── Constants ─────────────────────────────────────────────────────────────────
const MEXICO_CITY: [number, number] = [19.4326, -99.1332];
const DEFAULT_ZOOM = 13;

// ─── Form state ────────────────────────────────────────────────────────────────
const address = ref(props.initialData?.address ?? '');
const latitude = ref<number | null>(props.initialData?.latitude ?? null);
const longitude = ref<number | null>(props.initialData?.longitude ?? null);

// ─── Map refs ──────────────────────────────────────────────────────────────────
const mapContainer = ref<HTMLDivElement | null>(null);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mapInstance: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let markerInstance: any = null;

// ─── Geocoding state ───────────────────────────────────────────────────────────
const isGeocoding = ref(false);

// ─── Computed ──────────────────────────────────────────────────────────────────
const geocodingWarning = computed(() => store.geocodingWarning);
const isSaving = computed(() => store.loading);

// ─── Map initialisation (client-only via onMounted) ───────────────────────────
onMounted(async () => {
  if (!mapContainer.value) return;

  // Dynamic import to avoid SSR issues
  const L = await import('leaflet');
  await import('leaflet/dist/leaflet.css');

  // Fix default icon paths broken by bundlers
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  });

  const center: [number, number] =
    latitude.value !== null && longitude.value !== null
      ? [latitude.value, longitude.value]
      : MEXICO_CITY;

  mapInstance = L.map(mapContainer.value).setView(center, DEFAULT_ZOOM);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
  }).addTo(mapInstance);

  // Place marker if we have initial coordinates
  if (latitude.value !== null && longitude.value !== null) {
    markerInstance = L.marker([latitude.value, longitude.value], { draggable: true }).addTo(
      mapInstance,
    );
    attachDragEnd(L);
  }

  // Fix rendering when container becomes visible
  mapInstance.invalidateSize();
});

onUnmounted(() => {
  mapInstance?.remove();
  mapInstance = null;
  markerInstance = null;
});

// ─── Drag-end handler ──────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function attachDragEnd(L: any) {
  markerInstance?.on('dragend', () => {
    const pos = markerInstance.getLatLng();
    latitude.value = pos.lat;
    longitude.value = pos.lng;
  });
}

// ─── Place / move marker programmatically ─────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function placeMarker(lat: number, lng: number) {
  if (!mapInstance) return;
  const L = await import('leaflet');

  if (markerInstance) {
    markerInstance.setLatLng([lat, lng]);
  } else {
    markerInstance = L.marker([lat, lng], { draggable: true }).addTo(mapInstance);
    attachDragEnd(L);
  }

  mapInstance.setView([lat, lng], DEFAULT_ZOOM);
}

// ─── Address blur → geocode via store ─────────────────────────────────────────
async function onAddressBlur() {
  const trimmed = address.value.trim();
  if (!trimmed) return;

  isGeocoding.value = true;
  try {
    await store.saveLocation({ address: trimmed });
    // After save, sync coordinates from store
    const updated = store.profileData;
    if (updated?.latitude !== undefined && updated?.longitude !== undefined) {
      latitude.value = updated.latitude;
      longitude.value = updated.longitude;
      if (updated.latitude !== null && updated.longitude !== null) {
        await placeMarker(updated.latitude, updated.longitude);
      }
    }
  } finally {
    isGeocoding.value = false;
  }
}

// ─── Submit ────────────────────────────────────────────────────────────────────
function handleSubmit() {
  const dto: UpdateLocationDto = { address: address.value.trim() };
  if (latitude.value !== null) dto.latitude = latitude.value;
  if (longitude.value !== null) dto.longitude = longitude.value;
  emit('submit', dto);
}

// ─── Sync when initialData changes ────────────────────────────────────────────
watch(
  () => props.initialData,
  async (data) => {
    if (!data) return;
    address.value = data.address ?? '';
    latitude.value = data.latitude ?? null;
    longitude.value = data.longitude ?? null;
    if (data.latitude !== null && data.longitude !== null) {
      await placeMarker(data.latitude, data.longitude);
    }
  },
);
</script>

<template>
  <form class="space-y-6" novalidate @submit.prevent="handleSubmit">
    <!-- Dirección -->
    <div class="space-y-2">
      <label
        for="location-address"
        class="block text-xs font-medium text-[var(--color-on-surface-variant)] uppercase tracking-wider"
      >
        Dirección
      </label>
      <div class="relative">
        <input
          id="location-address"
          v-model="address"
          type="text"
          placeholder="Ej. Av. Insurgentes Sur 1234, Col. Del Valle, CDMX"
          class="w-full px-4 py-3 rounded-lg bg-[var(--color-surface-container-high)] border-none focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:bg-[var(--color-surface-container-lowest)] transition-all placeholder:text-[var(--color-outline)] pr-10"
          :disabled="isSaving"
          @blur="onAddressBlur"
        />
        <!-- Geocoding spinner -->
        <span
          v-if="isGeocoding"
          class="absolute right-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-base text-[var(--color-primary)] animate-spin"
        >
          progress_activity
        </span>
      </div>
      <p class="text-xs text-[var(--color-on-surface-variant)]">
        Al salir del campo se intentará ubicar la dirección en el mapa automáticamente.
      </p>
    </div>

    <!-- Geocoding warning -->
    <div
      v-if="geocodingWarning"
      class="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800"
      role="alert"
    >
      <span class="material-symbols-outlined text-base mt-0.5 shrink-0">warning</span>
      <span>{{ geocodingWarning }}</span>
    </div>

    <!-- Mapa Leaflet -->
    <div class="space-y-2">
      <p class="text-xs font-medium text-[var(--color-on-surface-variant)] uppercase tracking-wider">
        Ubicación en el mapa
      </p>
      <div
        ref="mapContainer"
        class="w-full h-64 rounded-xl overflow-hidden bg-[var(--color-surface-container-high)] z-0"
        aria-label="Mapa interactivo para seleccionar ubicación"
      />
      <p class="text-xs text-[var(--color-on-surface-variant)]">
        Arrastra el marcador para ajustar la ubicación exacta.
      </p>
    </div>

    <!-- Coordenadas (solo lectura, informativas) -->
    <div v-if="latitude !== null && longitude !== null" class="flex gap-4">
      <div class="flex-1 space-y-1">
        <p class="text-xs font-medium text-[var(--color-on-surface-variant)] uppercase tracking-wider">
          Latitud
        </p>
        <p class="text-sm text-[var(--color-on-surface)] font-mono">
          {{ latitude.toFixed(6) }}
        </p>
      </div>
      <div class="flex-1 space-y-1">
        <p class="text-xs font-medium text-[var(--color-on-surface-variant)] uppercase tracking-wider">
          Longitud
        </p>
        <p class="text-sm text-[var(--color-on-surface)] font-mono">
          {{ longitude.toFixed(6) }}
        </p>
      </div>
    </div>

    <!-- Submit -->
    <div class="pt-2">
      <button
        type="submit"
        :disabled="isSaving"
        class="w-full sm:w-auto px-10 py-3 bg-[var(--color-primary)] text-white rounded-lg font-semibold shadow-lg shadow-[var(--color-primary)]/10 hover:opacity-90 transition-all disabled:opacity-50"
      >
        {{ isSaving ? 'Guardando…' : 'Guardar ubicación' }}
      </button>
    </div>
  </form>
</template>
