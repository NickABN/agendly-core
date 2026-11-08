// @vitest-environment jsdom
import { mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, describe, expect, it } from 'vitest';
import { defineComponent, nextTick, ref } from 'vue';
import PhoneInput from './PhoneInput.vue';

type PhoneInputProps = {
  id?: string;
  modelValue?: string;
  disabled?: boolean;
  required?: boolean;
};

const mountedWrappers: VueWrapper[] = [];

function mountPhoneInput(props: PhoneInputProps = {}) {
  const wrapper = mount(PhoneInput, {
    props: {
      id: 'contact-phone',
      modelValue: '',
      ...props,
    },
    attachTo: document.body,
  });
  mountedWrappers.push(wrapper);
  return wrapper;
}

function phoneField(wrapper: VueWrapper) {
  return wrapper.get('input[type="tel"]');
}

function countryTrigger(wrapper: VueWrapper) {
  return wrapper.get('[aria-haspopup="listbox"]');
}

function lastModelValue(wrapper: VueWrapper) {
  const updates = wrapper.emitted('update:modelValue');
  return updates?.[updates.length - 1]?.[0];
}

async function chooseCountry(wrapper: VueWrapper, label: string) {
  await countryTrigger(wrapper).trigger('click');
  const option = wrapper.findAll('[role="option"]').find((item) => item.text().includes(label));
  expect(option, `Expected a country option containing "${label}"`).toBeDefined();
  await option!.trigger('click');
}

function digits(value: string) {
  return value.replace(/\D/g, '');
}

afterEach(() => {
  mountedWrappers.splice(0).forEach((wrapper) => wrapper.unmount());
  document.body.replaceChildren();
});

describe('PhoneInput', () => {
  it('defaults to Mexico and exposes the labeled national telephone input', () => {
    const wrapper = mountPhoneInput({ id: 'admin-phone', required: true });
    const field = phoneField(wrapper);

    expect(field.attributes('id')).toBe('admin-phone');
    expect(field.attributes('inputmode')).toBe('tel');
    expect(field.attributes('autocomplete')).toBe('tel-national');
    expect(field.attributes('placeholder')).toBe('55 1234 5678');
    expect(field.attributes('required')).toBeDefined();
    expect(countryTrigger(wrapper).text()).toContain('🇲🇽 México +52');

    // jsdom does not focus on label click; <label for="admin-phone"> targets the
    // element with that id, which must be the number input.
    expect(document.getElementById('admin-phone')).toBe(field.element);
  });

  it('disables both the country selector and number input when disabled', async () => {
    const wrapper = mountPhoneInput({ disabled: true });

    expect(phoneField(wrapper).attributes('disabled')).toBeDefined();
    expect(countryTrigger(wrapper).attributes('disabled')).toBeDefined();
    await countryTrigger(wrapper).trigger('click');
    expect(wrapper.find('[role="listbox"]').exists()).toBe(false);
  });

  it('offers all specified countries and keeps the US and Canada as separate +1 choices', async () => {
    const wrapper = mountPhoneInput();

    await countryTrigger(wrapper).trigger('click');
    expect(
      wrapper
        .findAll('[role="option"]')
        // The selected option renders a material-symbols "check" glyph as text.
        .map((option) =>
          option
            .text()
            .replace(/\s*check$/, '')
            .trim(),
        ),
    ).toEqual([
      '🇲🇽 México +52',
      '🇺🇸 Estados Unidos +1',
      '🇨🇦 Canadá +1',
      '🇪🇸 España +34',
      '🇨🇴 Colombia +57',
      '🇦🇷 Argentina +54',
      '🇨🇱 Chile +56',
      '🇵🇪 Perú +51',
      '🇬🇹 Guatemala +502',
      '🇨🇷 Costa Rica +506',
      '🇻🇪 Venezuela +58',
      '🇪🇨 Ecuador +593',
    ]);

    await wrapper.findAll('[role="option"]')[2]?.trigger('click');
    expect(countryTrigger(wrapper).text()).toContain('🇨🇦 Canadá +1');
    expect(phoneField(wrapper).attributes('placeholder')).toBe('Número');

    await chooseCountry(wrapper, '🇺🇸 Estados Unidos +1');
    expect(countryTrigger(wrapper).text()).toContain('🇺🇸 Estados Unidos +1');
  });

  it('emits a normalized Mexican E.164 value for a ten-digit national number', async () => {
    const wrapper = mountPhoneInput();

    await phoneField(wrapper).setValue('55 1234 5678');

    expect(lastModelValue(wrapper)).toBe('+525512345678');
  });

  it('keeps national digits when changing the lada and emits the selected country code', async () => {
    const wrapper = mountPhoneInput();
    const field = phoneField(wrapper);

    await field.setValue('61 2345 678');
    expect(lastModelValue(wrapper)).toBe('+52612345678');

    await chooseCountry(wrapper, '🇪🇸 España +34');

    expect(digits((phoneField(wrapper).element as HTMLInputElement).value)).toBe('612345678');
    expect(phoneField(wrapper).attributes('placeholder')).toBe('Número');
    expect(lastModelValue(wrapper)).toBe('+34612345678');
  });

  it('strips supported separators for foreign numbers and emits invalid attempts unchanged for validation', async () => {
    const wrapper = mountPhoneInput();
    await chooseCountry(wrapper, '🇪🇸 España +34');

    await phoneField(wrapper).setValue('61 (234) 567-8');
    expect(lastModelValue(wrapper)).toBe('+34612345678');

    await phoneField(wrapper).setValue('12-34');
    expect(lastModelValue(wrapper)).toBe('+341234');
  });

  it('emits an empty string when the national number is cleared', async () => {
    const wrapper = mountPhoneInput();
    const field = phoneField(wrapper);

    await field.setValue('55 1234 5678');
    await field.setValue('');

    expect(lastModelValue(wrapper)).toBe('');
  });

  it('parses Mexican and +1 model values into a country selection and national digits', () => {
    const mexican = mountPhoneInput({ modelValue: '+525512345678' });
    expect(countryTrigger(mexican).text()).toContain('🇲🇽 México +52');
    expect((phoneField(mexican).element as HTMLInputElement).value).toBe('5512345678');

    const us = mountPhoneInput({ id: 'us-phone', modelValue: '+14155551234' });
    expect(countryTrigger(us).text()).toContain('🇺🇸 Estados Unidos +1');
    expect((phoneField(us).element as HTMLInputElement).value).toBe('4155551234');
  });

  it('retains Canada when parsing a new +1 model value after Canada is selected', async () => {
    const wrapper = mountPhoneInput({ modelValue: '+14155551234' });

    await chooseCountry(wrapper, '🇨🇦 Canadá +1');
    await wrapper.setProps({ modelValue: '+14155551235' });

    expect(countryTrigger(wrapper).text()).toContain('🇨🇦 Canadá +1');
    expect((phoneField(wrapper).element as HTMLInputElement).value).toBe('4155551235');
  });

  it.each([
    ['+50255551234', '🇬🇹 Guatemala +502', '55551234'],
    ['+50655551234', '🇨🇷 Costa Rica +506', '55551234'],
    ['+593991234567', '🇪🇨 Ecuador +593', '991234567'],
  ])('uses the longest country-code prefix when parsing %s', (modelValue, country, national) => {
    const wrapper = mountPhoneInput({ modelValue });

    expect(countryTrigger(wrapper).text()).toContain(country);
    expect((phoneField(wrapper).element as HTMLInputElement).value).toBe(national);
  });

  it('falls back to Mexico and keeps the raw digits for an unknown incoming country code', () => {
    const wrapper = mountPhoneInput({ modelValue: '+99912345678' });

    expect(countryTrigger(wrapper).text()).toContain('🇲🇽 México +52');
    expect((phoneField(wrapper).element as HTMLInputElement).value).toBe('99912345678');
  });

  it('keeps the typed spacing when the parent echoes the value back through v-model', async () => {
    const Host = defineComponent({
      components: { PhoneInput },
      setup() {
        const phone = ref('');
        return { phone };
      },
      template: '<PhoneInput id="echo-phone" v-model="phone" />',
    });
    const wrapper = mount(Host, { attachTo: document.body });
    mountedWrappers.push(wrapper as unknown as VueWrapper);
    const field = wrapper.get('#echo-phone');

    await field.setValue('55 12');
    await nextTick();

    expect((field.element as HTMLInputElement).value).toBe('55 12');
    expect((wrapper.vm as unknown as { phone: string }).phone).toBe('+525512');
  });
});
