<script setup lang="ts">
import type { ImageVersionDto } from '@agendly/shared';

const props = defineProps<{
  images: ImageVersionDto[];
  type: 'LOGO' | 'BANNER';
}>();

// ─── Computed ──────────────────────────────────────────────────────────────────
const filtered = computed(() => props.images.filter((img) => img.imageType === props.type));

const label = computed(() => (props.type === 'LOGO' ? 'logo' : 'banner'));

// ─── Formatters ────────────────────────────────────────────────────────────────
function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${Math.round(bytes / 1024)} KB`;
}

const dateFormatter = new Intl.DateTimeFormat('es-MX', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

function formatDate(isoString: string): string {
  return dateFormatter.format(new Date(isoString));
}
</script>

<template>
  <div class="space-y-2">
    <!-- Empty state -->
    <p
      v-if="filtered.length === 0"
      class="text-sm text-[var(--color-on-surface-variant)] py-4 text-center"
    >
      No hay imágenes de {{ label }} subidas aún.
    </p>

    <!-- Scrollable list -->
    <ul
      v-else
      class="max-h-64 overflow-y-auto divide-y divide-[var(--color-outline-variant)]/30 rounded-xl border border-[var(--color-outline-variant)]/30"
    >
      <li
        v-for="image in filtered"
        :key="image.id"
        class="flex items-center gap-3 px-3 py-2.5 hover:bg-[var(--color-surface-container-high)] transition-colors"
      >
        <!-- Thumbnail -->
        <img
          :src="image.url"
          :alt="`Versión de ${label}`"
          class="w-12 h-12 rounded-lg object-cover shrink-0 bg-[var(--color-surface-container-highest)]"
        />

        <!-- Meta -->
        <div class="min-w-0 flex-1">
          <p class="text-xs text-[var(--color-on-surface)] truncate">
            {{ formatDate(image.createdAt) }}
          </p>
          <p class="text-xs text-[var(--color-on-surface-variant)] mt-0.5">
            {{ formatFileSize(image.fileSize) }}
          </p>
        </div>

        <!-- Link to full image -->
        <a
          :href="image.url"
          target="_blank"
          rel="noopener noreferrer"
          class="shrink-0 text-[var(--color-on-surface-variant)] hover:text-[var(--color-primary)] transition-colors"
          :aria-label="`Ver imagen de ${label} subida el ${formatDate(image.createdAt)}`"
        >
          <span class="material-symbols-outlined text-lg">open_in_new</span>
        </a>
      </li>
    </ul>
  </div>
</template>
