// @vitest-environment jsdom
import { mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { computed, ref } from 'vue';
import OnboardingSelect from './OnboardingSelect.vue';

let mountedWrappers: VueWrapper[] = [];

const durationOptions = [
  { value: 30, label: '30 minutos' },
  { value: 45, label: '45 minutos' },
  { value: 60, label: '1 hora' },
] as const;

const roleOptions = [
  { value: 'stylist', label: 'Estilista' },
  { value: 'barber', label: 'Barbero' },
] as const;

function mountSelect(
  props: {
    id?: string;
    modelValue?: string | number;
    options?: readonly { value: string | number; label: string }[];
    disabled?: boolean;
  } = {},
) {
  const wrapper = mount(OnboardingSelect, {
    props: {
      id: props.id ?? 'service-duration-0',
      modelValue: props.modelValue ?? durationOptions[0].value,
      options: props.options ?? durationOptions,
      disabled: props.disabled ?? false,
    },
    attachTo: document.body,
  });
  mountedWrappers.push(wrapper);
  return wrapper;
}

function trigger(wrapper: VueWrapper) {
  return wrapper.get('[aria-haspopup="listbox"]');
}

function listbox(wrapper: VueWrapper) {
  return wrapper.find('[role="listbox"]');
}

beforeEach(() => {
  mountedWrappers = [];
  vi.stubGlobal('computed', computed);
  vi.stubGlobal('ref', ref);
});

afterEach(() => {
  mountedWrappers.forEach((wrapper) => wrapper.unmount());
  vi.unstubAllGlobals();
});

describe('OnboardingSelect custom listbox', () => {
  it('renders the selected option label on the trigger and keeps the id for label association', () => {
    const wrapper = mountSelect({ id: 'service-duration-0', modelValue: 60 });

    const button = trigger(wrapper);
    expect(button.attributes('id')).toBe('service-duration-0');
    expect(button.attributes('aria-haspopup')).toBe('listbox');
    expect(button.attributes('aria-expanded')).toBe('false');
    expect(button.text()).toContain('1 hora');
  });

  it('opens and shows every option as a listbox role with aria-selected on the current value', async () => {
    const wrapper = mountSelect({ modelValue: 45 });

    expect(listbox(wrapper).exists()).toBe(false);
    await trigger(wrapper).trigger('click');

    expect(listbox(wrapper).exists()).toBe(true);
    expect(trigger(wrapper).attributes('aria-expanded')).toBe('true');

    const options = wrapper.findAll('[role="option"]');
    expect(options).toHaveLength(3);
    expect(options[0]?.text()).toContain('30 minutos');
    expect(options[1]?.text()).toContain('45 minutos');
    expect(options[2]?.text()).toContain('1 hora');
    const selected = options.find((o) => o.attributes('aria-selected') === 'true');
    expect(selected?.text()).toContain('45 minutos');
  });

  it('emits the original numeric value when a number option is selected', async () => {
    const wrapper = mountSelect({ modelValue: 30 });

    await trigger(wrapper).trigger('click');
    const options = wrapper.findAll('[role="option"]');
    await options[2]?.trigger('click');

    const emitted = wrapper.emitted('update:modelValue');
    expect(emitted).toBeTruthy();
    const value = emitted?.[0]?.[0];
    expect(value).toBe(60);
    expect(typeof value).toBe('number');
  });

  it('emits the original string value for string options', async () => {
    const wrapper = mountSelect({ modelValue: 'stylist', options: roleOptions });

    await trigger(wrapper).trigger('click');
    const options = wrapper.findAll('[role="option"]');
    await options[1]?.trigger('click');

    const value = wrapper.emitted('update:modelValue')?.[0]?.[0];
    expect(value).toBe('barber');
    expect(typeof value).toBe('string');
  });

  it('opens with ArrowDown, moves the active option with arrows, and selects with Enter', async () => {
    const wrapper = mountSelect({ modelValue: 30 });
    const button = trigger(wrapper);

    await button.trigger('keydown', { key: 'ArrowDown' });
    expect(listbox(wrapper).exists()).toBe(true);

    await button.trigger('keydown', { key: 'ArrowDown' });
    await button.trigger('keydown', { key: 'Enter' });

    const value = wrapper.emitted('update:modelValue')?.[0]?.[0];
    expect(value).toBe(45);
    expect(listbox(wrapper).exists()).toBe(false);
  });

  it('closes on Escape without emitting a change', async () => {
    const wrapper = mountSelect({ modelValue: 30 });
    const button = trigger(wrapper);

    await button.trigger('click');
    expect(listbox(wrapper).exists()).toBe(true);

    await button.trigger('keydown', { key: 'Escape' });
    expect(listbox(wrapper).exists()).toBe(false);
    expect(wrapper.emitted('update:modelValue')).toBeFalsy();
  });

  it('does not open when disabled', async () => {
    const wrapper = mountSelect({ disabled: true });
    const button = trigger(wrapper);

    await button.trigger('click');
    expect(listbox(wrapper).exists()).toBe(false);

    await button.trigger('keydown', { key: 'ArrowDown' });
    expect(listbox(wrapper).exists()).toBe(false);
  });
});
