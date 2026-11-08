<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { normalizeMxPhone, normalizePhone } from '@agendly/shared';
import AppSelect from './AppSelect.vue';

interface Country {
  value: string;
  dialCode: string;
  label: string;
}

const countries: readonly Country[] = [
  { value: 'MX', dialCode: '52', label: '🇲🇽 México +52' },
  { value: 'US', dialCode: '1', label: '🇺🇸 Estados Unidos +1' },
  { value: 'CA', dialCode: '1', label: '🇨🇦 Canadá +1' },
  { value: 'ES', dialCode: '34', label: '🇪🇸 España +34' },
  { value: 'CO', dialCode: '57', label: '🇨🇴 Colombia +57' },
  { value: 'AR', dialCode: '54', label: '🇦🇷 Argentina +54' },
  { value: 'CL', dialCode: '56', label: '🇨🇱 Chile +56' },
  { value: 'PE', dialCode: '51', label: '🇵🇪 Perú +51' },
  { value: 'GT', dialCode: '502', label: '🇬🇹 Guatemala +502' },
  { value: 'CR', dialCode: '506', label: '🇨🇷 Costa Rica +506' },
  { value: 'VE', dialCode: '58', label: '🇻🇪 Venezuela +58' },
  { value: 'EC', dialCode: '593', label: '🇪🇨 Ecuador +593' },
];

type CountryValue = (typeof countries)[number]['value'];

const props = withDefaults(
  defineProps<{
    id?: string;
    modelValue?: string;
    disabled?: boolean;
    required?: boolean;
  }>(),
  { modelValue: '' },
);

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();

const selectedCountry = ref<CountryValue>('MX');
const nationalNumber = ref('');
const countryOptions = countries.map(({ value, label }) => ({ value, label }));

const currentCountry = computed(
  () => countries.find((country) => country.value === selectedCountry.value) ?? countries[0]!,
);
const countrySelectId = computed(() => `${props.id ?? 'phone-input'}-country`);
const numberPlaceholder = computed(() =>
  selectedCountry.value === 'MX' ? '55 1234 5678' : 'Número',
);

function parseModelValue(value: string) {
  if (!value) {
    nationalNumber.value = '';
    return;
  }

  const compactValue = value.replace(/[\s().-]/g, '');
  const digits = compactValue.replace(/\D/g, '');

  if (compactValue.startsWith('+1')) {
    if (selectedCountry.value !== 'CA') selectedCountry.value = 'US';
    nationalNumber.value = digits.slice(1);
    return;
  }

  const matchedCountry = [...countries]
    .filter((country) => country.value !== 'US' && country.value !== 'CA')
    .sort((left, right) => right.dialCode.length - left.dialCode.length)
    .find((country) => compactValue.startsWith(`+${country.dialCode}`));

  if (matchedCountry) {
    selectedCountry.value = matchedCountry.value;
    nationalNumber.value = digits.slice(matchedCountry.dialCode.length);
    return;
  }

  selectedCountry.value = 'MX';
  nationalNumber.value = digits;
}

// Last value this component emitted. When the parent echoes it back through
// v-model we must not re-parse it, or the typed spacing (and caret) is lost.
let lastEmitted: string | null = null;

function emitValue(value: string) {
  lastEmitted = value;
  emit('update:modelValue', value);
}

function emitCurrentValue() {
  const digits = nationalNumber.value.replace(/\D/g, '');
  if (!digits) {
    emitValue('');
    return;
  }

  if (selectedCountry.value === 'MX') {
    emitValue(normalizeMxPhone(digits) ?? `+${currentCountry.value.dialCode}${digits}`);
    return;
  }

  const attempt = `+${currentCountry.value.dialCode}${digits}`;
  emitValue(normalizePhone(attempt) ?? attempt);
}

function onNumberInput(event: Event) {
  nationalNumber.value = (event.target as HTMLInputElement).value;
  emitCurrentValue();
}

function onCountryChange(value: CountryValue) {
  selectedCountry.value = value;
  emitCurrentValue();
}

watch(
  () => props.modelValue,
  (value) => {
    if (value === lastEmitted) return;
    parseModelValue(value);
  },
  { immediate: true },
);
</script>

<template>
  <div class="grid grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] gap-2">
    <AppSelect
      :id="countrySelectId"
      :model-value="selectedCountry"
      :options="countryOptions"
      :disabled="disabled"
      @update:model-value="onCountryChange"
    />
    <input
      :id="id"
      type="tel"
      inputmode="tel"
      autocomplete="tel-national"
      :value="nationalNumber"
      :disabled="disabled"
      :required="required"
      :placeholder="numberPlaceholder"
      class="w-full min-w-0 rounded-lg border border-[var(--color-outline-variant)]/20 bg-[var(--color-surface-container-high)] px-4 py-3 text-base text-[var(--color-on-surface)] transition-colors placeholder:text-[var(--color-on-surface-variant)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 disabled:cursor-not-allowed disabled:opacity-60"
      @input="onNumberInput"
    />
  </div>
</template>
