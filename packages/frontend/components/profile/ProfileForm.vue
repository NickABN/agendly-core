<script setup lang="ts">
import type { ProfileDto, UpdateProfileDto } from '@agendly/shared';

interface TimezoneOption {
  value: string;
  label: string;
}

const MEXICO_TIMEZONES: TimezoneOption[] = [
  { value: 'America/Mexico_City', label: 'Centro (America/Mexico_City)' },
  { value: 'America/Monterrey', label: 'Noreste (America/Monterrey)' },
  { value: 'America/Tijuana', label: 'Noroeste / Pacífico (America/Tijuana)' },
  { value: 'America/Cancun', label: 'Sureste (America/Cancun)' },
  { value: 'America/Chihuahua', label: 'Montaña (America/Chihuahua)' },
  { value: 'America/Hermosillo', label: 'Sonora (America/Hermosillo)' },
];

const VALID_TIMEZONES = MEXICO_TIMEZONES.map((tz) => tz.value);

const E164_REGEX = /^\+[1-9]\d{1,14}$/;

const props = defineProps<{
  initialData?: ProfileDto;
}>();

const emit = defineEmits<{
  submit: [dto: UpdateProfileDto];
}>();

// ─── Form state ────────────────────────────────────────────────────────────────
const form = reactive({
  name: props.initialData?.name ?? '',
  phone: props.initialData?.phone ?? '',
  timezone: props.initialData?.timezone ?? 'America/Mexico_City',
});

// ─── Validation errors ─────────────────────────────────────────────────────────
const errors = reactive({
  name: '',
  phone: '',
  timezone: '',
});

// ─── Validation helpers ────────────────────────────────────────────────────────
function validateName(value: string): string {
  if (value.length < 2) return 'El nombre debe tener al menos 2 caracteres.';
  if (value.length > 100) return 'El nombre no puede superar los 100 caracteres.';
  return '';
}

function validatePhone(value: string): string {
  if (value === '') return ''; // phone is optional; empty is allowed
  if (!E164_REGEX.test(value)) return 'El teléfono debe estar en formato E.164 (ej. +521XXXXXXXXXX).';
  return '';
}

function validateTimezone(value: string): string {
  if (!VALID_TIMEZONES.includes(value)) return 'Selecciona una zona horaria válida.';
  return '';
}

function validate(): boolean {
  errors.name = validateName(form.name);
  errors.phone = validatePhone(form.phone);
  errors.timezone = validateTimezone(form.timezone);
  return !errors.name && !errors.phone && !errors.timezone;
}

// ─── Submit ────────────────────────────────────────────────────────────────────
function handleSubmit() {
  if (!validate()) return;

  const dto: UpdateProfileDto = {};
  if (form.name) dto.name = form.name;
  if (form.phone) dto.phone = form.phone;
  if (form.timezone) dto.timezone = form.timezone;

  emit('submit', dto);
}

// ─── Sync when initialData changes (e.g. after fetch) ─────────────────────────
watch(
  () => props.initialData,
  (data) => {
    if (!data) return;
    form.name = data.name ?? '';
    form.phone = data.phone ?? '';
    form.timezone = data.timezone ?? 'America/Mexico_City';
  },
);
</script>

<template>
  <form class="space-y-6" novalidate @submit.prevent="handleSubmit">
    <!-- Nombre del negocio -->
    <div class="space-y-2">
      <label
        for="profile-name"
        class="block text-xs font-medium text-[var(--color-on-surface-variant)] uppercase tracking-wider"
      >
        Nombre del negocio
      </label>
      <input
        id="profile-name"
        v-model="form.name"
        type="text"
        placeholder="Ej. Salón Calma"
        maxlength="100"
        class="w-full px-4 py-3 rounded-lg bg-[var(--color-surface-container-high)] border-none focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:bg-[var(--color-surface-container-lowest)] transition-all placeholder:text-[var(--color-outline)]"
        :class="{ 'ring-2 ring-red-400': errors.name }"
        @blur="errors.name = validateName(form.name)"
      />
      <p v-if="errors.name" class="text-xs text-red-600">{{ errors.name }}</p>
    </div>

    <!-- Teléfono (E.164) -->
    <div class="space-y-2">
      <label
        for="profile-phone"
        class="block text-xs font-medium text-[var(--color-on-surface-variant)] uppercase tracking-wider"
      >
        Teléfono
        <span class="normal-case font-normal text-[var(--color-outline)] ml-1">(opcional)</span>
      </label>
      <input
        id="profile-phone"
        v-model="form.phone"
        type="tel"
        placeholder="+521XXXXXXXXXX"
        class="w-full px-4 py-3 rounded-lg bg-[var(--color-surface-container-high)] border-none focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:bg-[var(--color-surface-container-lowest)] transition-all placeholder:text-[var(--color-outline)]"
        :class="{ 'ring-2 ring-red-400': errors.phone }"
        @blur="errors.phone = validatePhone(form.phone)"
      />
      <p v-if="errors.phone" class="text-xs text-red-600">{{ errors.phone }}</p>
      <p v-else class="text-xs text-[var(--color-on-surface-variant)]">
        Incluye el código de país, ej. +521XXXXXXXXXX
      </p>
    </div>

    <!-- Zona horaria -->
    <div class="space-y-2">
      <label
        for="profile-timezone"
        class="block text-xs font-medium text-[var(--color-on-surface-variant)] uppercase tracking-wider"
      >
        Zona horaria
      </label>
      <select
        id="profile-timezone"
        v-model="form.timezone"
        class="w-full px-4 py-3 rounded-lg bg-[var(--color-surface-container-high)] border-none focus:ring-2 focus:ring-[var(--color-primary)]/20 transition-all appearance-none cursor-pointer"
        :class="{ 'ring-2 ring-red-400': errors.timezone }"
        @blur="errors.timezone = validateTimezone(form.timezone)"
        @change="errors.timezone = validateTimezone(form.timezone)"
      >
        <option v-for="tz in MEXICO_TIMEZONES" :key="tz.value" :value="tz.value">
          {{ tz.label }}
        </option>
      </select>
      <p v-if="errors.timezone" class="text-xs text-red-600">{{ errors.timezone }}</p>
    </div>

    <!-- Submit -->
    <div class="pt-2">
      <button
        type="submit"
        class="w-full sm:w-auto px-10 py-3 bg-[var(--color-primary)] text-white rounded-lg font-semibold shadow-lg shadow-[var(--color-primary)]/10 hover:opacity-90 transition-all disabled:opacity-50"
      >
        Guardar cambios
      </button>
    </div>
  </form>
</template>
