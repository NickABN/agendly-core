<script setup lang="ts" generic="T extends string | number">
interface SelectOption<Value extends string | number> {
  value: Value;
  label: string;
}

const props = defineProps<{
  id: string;
  modelValue: T;
  options: readonly SelectOption<T>[];
  disabled?: boolean;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: T];
}>();

function updateValue(event: Event) {
  const selectedValue = (event.target as HTMLSelectElement).value;
  const selectedOption = props.options.find((option) => String(option.value) === selectedValue);

  if (selectedOption) emit('update:modelValue', selectedOption.value);
}
</script>

<template>
  <div class="relative">
    <select
      :id="id"
      :value="String(modelValue)"
      :disabled="disabled"
      class="w-full cursor-pointer appearance-none rounded-lg border border-[var(--color-outline-variant)]/20 bg-[var(--color-surface-container-high)] px-4 py-3 pr-10 text-base text-[var(--color-on-surface)] transition-colors hover:bg-[var(--color-surface-container-lowest)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 disabled:cursor-not-allowed disabled:opacity-60"
      @change="updateValue"
    >
      <option
        v-for="option in options"
        :key="String(option.value)"
        :value="String(option.value)"
      >
        {{ option.label }}
      </option>
    </select>
    <span
      class="material-symbols-outlined pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-on-surface-variant)]"
      aria-hidden="true"
    >
      expand_more
    </span>
  </div>
</template>
