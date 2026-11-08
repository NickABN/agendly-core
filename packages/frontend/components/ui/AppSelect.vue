<script setup lang="ts" generic="T extends string | number">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';

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

const open = ref(false);
const activeIndex = ref(-1);
const rootEl = ref<HTMLElement | null>(null);
const triggerEl = ref<HTMLButtonElement | null>(null);

const listboxId = computed(() => `${props.id}-listbox`);

const selectedIndex = computed(() =>
  props.options.findIndex((option) => option.value === props.modelValue),
);

const selectedLabel = computed(() => {
  const option = props.options[selectedIndex.value];
  return option ? option.label : '';
});

function optionId(index: number) {
  return `${props.id}-option-${index}`;
}

function focusTrigger() {
  triggerEl.value?.focus();
}

function openList() {
  if (props.disabled || open.value) return;
  open.value = true;
  activeIndex.value = selectedIndex.value >= 0 ? selectedIndex.value : 0;
  void nextTick(() => scrollActiveIntoView());
}

function closeList(returnFocus = false) {
  if (!open.value) return;
  open.value = false;
  activeIndex.value = -1;
  if (returnFocus) focusTrigger();
}

function toggleList() {
  if (props.disabled) return;
  if (open.value) closeList();
  else openList();
}

function selectOption(index: number) {
  const option = props.options[index];
  if (!option) return;
  if (option.value !== props.modelValue) emit('update:modelValue', option.value);
  closeList(true);
}

function moveActive(delta: number) {
  if (props.options.length === 0) return;
  const next = activeIndex.value + delta;
  activeIndex.value = Math.min(Math.max(next, 0), props.options.length - 1);
  void nextTick(() => scrollActiveIntoView());
}

function scrollActiveIntoView() {
  if (activeIndex.value < 0) return;
  const el = rootEl.value?.querySelectorAll<HTMLElement>('[role="option"]')[activeIndex.value];
  el?.scrollIntoView?.({ block: 'nearest' });
}

function onTriggerKeydown(event: KeyboardEvent) {
  if (props.disabled) return;

  if (!open.value) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      openList();
    } else if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
      event.preventDefault();
      openList();
    }
    return;
  }

  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault();
      moveActive(1);
      break;
    case 'ArrowUp':
      event.preventDefault();
      moveActive(-1);
      break;
    case 'Home':
      event.preventDefault();
      activeIndex.value = 0;
      void nextTick(() => scrollActiveIntoView());
      break;
    case 'End':
      event.preventDefault();
      activeIndex.value = props.options.length - 1;
      void nextTick(() => scrollActiveIntoView());
      break;
    case 'Enter':
    case ' ':
    case 'Spacebar':
      event.preventDefault();
      if (activeIndex.value >= 0) selectOption(activeIndex.value);
      break;
    case 'Escape':
      event.preventDefault();
      closeList(true);
      break;
    case 'Tab':
      closeList();
      break;
    default:
      break;
  }
}

function onDocumentPointerDown(event: PointerEvent) {
  if (!open.value) return;
  const target = event.target as Node | null;
  if (target && rootEl.value && !rootEl.value.contains(target)) closeList();
}

watch(open, (isOpen) => {
  if (isOpen) document.addEventListener('pointerdown', onDocumentPointerDown, true);
  else document.removeEventListener('pointerdown', onDocumentPointerDown, true);
});

watch(
  () => props.disabled,
  (isDisabled) => {
    if (isDisabled) closeList();
  },
);

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocumentPointerDown, true);
});
</script>

<template>
  <div ref="rootEl" class="relative">
    <button
      :id="id"
      ref="triggerEl"
      type="button"
      :disabled="disabled"
      :aria-expanded="open"
      :aria-controls="open ? listboxId : undefined"
      aria-haspopup="listbox"
      :aria-activedescendant="open && activeIndex >= 0 ? optionId(activeIndex) : undefined"
      class="flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg border border-[var(--color-outline-variant)]/20 bg-[var(--color-surface-container-high)] px-4 py-3 text-left text-base text-[var(--color-on-surface)] transition-colors hover:bg-[var(--color-surface-container-lowest)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 disabled:cursor-not-allowed disabled:opacity-60"
      @click="toggleList"
      @keydown="onTriggerKeydown"
    >
      <span class="truncate">{{ selectedLabel }}</span>
      <span
        class="material-symbols-outlined pointer-events-none shrink-0 text-[var(--color-on-surface-variant)] transition-transform"
        :class="open ? 'rotate-180' : ''"
        aria-hidden="true"
      >
        expand_more
      </span>
    </button>

    <ul
      v-if="open"
      :id="listboxId"
      role="listbox"
      class="absolute left-0 right-0 z-50 mt-2 max-h-60 w-full max-w-[calc(100vw-2rem)] overflow-y-auto rounded-xl border border-[var(--color-outline-variant)]/20 bg-[var(--color-surface-container-lowest)] py-1 shadow-xl shadow-black/10"
    >
      <li
        v-for="(option, index) in options"
        :id="optionId(index)"
        :key="String(option.value)"
        role="option"
        :aria-selected="option.value === modelValue"
        class="flex cursor-pointer items-center justify-between gap-2 px-4 py-2.5 text-base text-[var(--color-on-surface)] transition-colors"
        :class="[
          index === activeIndex
            ? 'bg-[var(--color-primary)]/10'
            : 'hover:bg-[var(--color-surface-container-high)]',
          option.value === modelValue ? 'font-medium text-[var(--color-primary)]' : '',
        ]"
        @click="selectOption(index)"
        @mousemove="activeIndex = index"
      >
        <span class="truncate">{{ option.label }}</span>
        <span
          v-if="option.value === modelValue"
          class="material-symbols-outlined shrink-0 text-[var(--color-primary)]"
          aria-hidden="true"
        >
          check
        </span>
      </li>
    </ul>
  </div>
</template>
