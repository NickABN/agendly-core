<script setup lang="ts">
import { useProfileStore } from '~/stores/profile';

const props = defineProps<{
  type: 'logo' | 'banner';
  currentUrl: string | null;
  maxSizeMb: number;
}>();

const emit = defineEmits<{
  uploaded: [url: string];
}>();

const store = useProfileStore();

// ─── State ─────────────────────────────────────────────────────────────────────
const isDragging = ref(false);
const previewUrl = ref<string | null>(null);
const errorMessage = ref<string | null>(null);
const fileInputRef = ref<HTMLInputElement | null>(null);

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// ─── Computed ──────────────────────────────────────────────────────────────────
const displayUrl = computed(() => previewUrl.value ?? props.currentUrl);
const isUploading = computed(() => store.loading);
const uploadProgress = computed(() => store.uploadProgress);

const label = computed(() => (props.type === 'logo' ? 'Logo' : 'Banner'));
const aspectClass = computed(() =>
  props.type === 'logo' ? 'aspect-square w-40 max-w-full' : 'aspect-[3/1] w-full',
);

function notifyToast(kind: 'success' | 'error', message: string) {
  try {
    useAppToast()[kind](message);
  } catch {
    // Keep inline feedback available when mounted outside a Nuxt app context.
  }
}

function clearPreview() {
  if (!previewUrl.value) return;
  if (typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(previewUrl.value);
  previewUrl.value = null;
}

// ─── Validation ────────────────────────────────────────────────────────────────
function validateFile(file: File): string | null {
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return 'Solo se permiten archivos JPEG, PNG o WebP.';
  }
  const maxBytes = props.maxSizeMb * 1024 * 1024;
  if (file.size > maxBytes) {
    return `El archivo excede el tamaño máximo de ${props.maxSizeMb} MB.`;
  }
  return null;
}

// ─── File processing ───────────────────────────────────────────────────────────
async function processFile(file: File) {
  errorMessage.value = null;

  const validationError = validateFile(file);
  if (validationError) {
    errorMessage.value = validationError;
    notifyToast('error', validationError);
    return;
  }

  clearPreview();
  // Show local preview immediately.
  previewUrl.value = URL.createObjectURL(file);

  try {
    if (props.type === 'logo') {
      await store.uploadLogo(file);
    } else {
      await store.uploadBanner(file);
    }

    if (store.error) {
      errorMessage.value = store.error;
      notifyToast('error', store.error);
      clearPreview();
      return;
    }

    notifyToast('success', props.type === 'logo' ? 'Logo actualizado.' : 'Banner actualizado.');

    const newUrl =
      props.type === 'logo'
        ? (store.profileData?.logoUrl ?? null)
        : (store.profileData?.bannerUrl ?? null);

    if (newUrl) {
      emit('uploaded', newUrl);
    }
  } catch {
    errorMessage.value = 'Ocurrió un error al subir la imagen. Intenta de nuevo.';
    notifyToast('error', errorMessage.value);
    clearPreview();
  }
}

// ─── Click to upload ───────────────────────────────────────────────────────────
function openFilePicker() {
  if (isUploading.value) return;
  fileInputRef.value?.click();
}

function onFileInputChange(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file) {
    processFile(file);
  }
  // Reset so the same file can be re-selected
  input.value = '';
}

// ─── Drag and drop ─────────────────────────────────────────────────────────────
function onDragOver(event: DragEvent) {
  event.preventDefault();
  isDragging.value = true;
}

function onDragLeave() {
  isDragging.value = false;
}

function onDrop(event: DragEvent) {
  event.preventDefault();
  isDragging.value = false;
  if (isUploading.value) return;
  const file = event.dataTransfer?.files?.[0];
  if (file) {
    processFile(file);
  }
}

// ─── Cleanup object URLs ───────────────────────────────────────────────────────
onUnmounted(() => {
  clearPreview();
});
</script>

<template>
  <div class="space-y-3">
    <!-- Current / preview image -->
    <div
      v-if="displayUrl"
      :class="[
        'relative overflow-hidden rounded-xl bg-[var(--color-surface-container-high)]',
        aspectClass,
      ]"
      @dragover="onDragOver"
      @dragleave="onDragLeave"
      @drop="onDrop"
    >
      <img
        :src="displayUrl"
        :alt="`Vista previa del ${label.toLowerCase()}`"
        class="size-full object-cover"
      />
      <div
        v-if="isDragging"
        class="absolute inset-0 flex items-center justify-center bg-[var(--color-primary)]/75 p-4 text-center text-sm font-semibold text-white"
      >
        Suelta la imagen para reemplazarla
      </div>
    </div>

    <!-- Drop zone -->
    <div
      v-else
      role="button"
      :tabindex="isUploading ? -1 : 0"
      :aria-disabled="isUploading"
      :aria-label="`Subir ${label.toLowerCase()}`"
      class="relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 cursor-pointer transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/40"
      :class="[
        isDragging
          ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5'
          : 'border-[var(--color-outline-variant)]/40 bg-[var(--color-surface-container-high)] hover:border-[var(--color-primary)]/50 hover:bg-[var(--color-surface-container-highest)]',
        isUploading ? 'pointer-events-none opacity-60' : '',
      ]"
      @click="openFilePicker"
      @keydown.enter.prevent="openFilePicker"
      @keydown.space.prevent="openFilePicker"
      @dragover="onDragOver"
      @dragleave="onDragLeave"
      @drop="onDrop"
    >
      <!-- Upload icon -->
      <span
        class="material-symbols-outlined text-4xl"
        :class="
          isDragging ? 'text-[var(--color-primary)]' : 'text-[var(--color-on-surface-variant)]'
        "
      >
        cloud_upload
      </span>

      <!-- Instructions -->
      <div class="text-center">
        <p class="text-sm font-medium text-[var(--color-on-surface)]">
          {{
            isDragging ? 'Suelta la imagen aquí' : 'Arrastra una imagen o haz clic para seleccionar'
          }}
        </p>
      </div>
    </div>

    <button
      v-if="displayUrl"
      type="button"
      :disabled="isUploading"
      class="rounded-lg border border-[var(--color-outline-variant)] px-4 py-2 text-sm font-semibold text-[var(--color-on-surface)] transition-colors hover:bg-[var(--color-surface-container-high)] disabled:cursor-not-allowed disabled:opacity-50"
      @click="openFilePicker"
    >
      Cambiar {{ label.toLowerCase() }}
    </button>

    <p class="text-xs text-[var(--color-on-surface-variant)]">
      JPEG, PNG o WebP · Máximo {{ maxSizeMb }} MB
    </p>

    <!-- Hidden file input -->
    <input
      ref="fileInputRef"
      type="file"
      accept="image/jpeg,image/png,image/webp"
      class="sr-only"
      :aria-hidden="true"
      @change="onFileInputChange"
    />

    <!-- Upload progress -->
    <div v-if="isUploading" class="space-y-1" role="status" aria-live="polite">
      <div class="flex items-center justify-between text-xs text-[var(--color-on-surface-variant)]">
        <span>Subiendo {{ label.toLowerCase() }}…</span>
        <span>{{ uploadProgress }}%</span>
      </div>
      <div
        class="w-full h-1.5 rounded-full bg-[var(--color-surface-container-highest)] overflow-hidden"
      >
        <div
          class="h-full rounded-full bg-[var(--color-primary)] transition-all duration-300"
          :style="{ width: `${uploadProgress}%` }"
        />
      </div>
    </div>

    <!-- Error message -->
    <p v-if="errorMessage" class="flex items-center gap-1.5 text-xs text-red-600" role="alert">
      <span class="material-symbols-outlined text-sm">error</span>
      {{ errorMessage }}
    </p>
  </div>
</template>
