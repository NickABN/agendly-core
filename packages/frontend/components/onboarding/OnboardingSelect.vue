<script setup lang="ts" generic="T extends string | number">
/**
 * Thin wrapper kept for backward compatibility with onboarding code.
 * The styled listbox now lives in `components/ui/AppSelect.vue`; this simply
 * forwards props and the `update:modelValue` event so existing usages keep
 * working; OnboardingSelect.spec.ts covers the forwarding.
 */
import AppSelect from '~/components/ui/AppSelect.vue';

interface SelectOption<Value extends string | number> {
  value: Value;
  label: string;
}

defineProps<{
  id: string;
  modelValue: T;
  options: readonly SelectOption<T>[];
  disabled?: boolean;
}>();

defineEmits<{
  'update:modelValue': [value: T];
}>();
</script>

<template>
  <AppSelect
    :id="id"
    :model-value="modelValue"
    :options="options"
    :disabled="disabled"
    @update:model-value="$emit('update:modelValue', $event)"
  />
</template>
