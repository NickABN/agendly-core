// @vitest-environment jsdom

import { mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { reactive, watch } from 'vue';
import type { ProfileDto } from '@agendly/shared';
import ProfileForm from './ProfileForm.vue';

const mountedWrappers: VueWrapper[] = [];

function profile(overrides: Partial<ProfileDto> = {}): ProfileDto {
  return {
    id: 'tenant-1',
    name: 'Salón Calma',
    slug: 'salon-calma',
    phone: null,
    address: null,
    logoUrl: null,
    bannerUrl: null,
    latitude: null,
    longitude: null,
    timezone: 'America/Mexico_City',
    onboardedAt: null,
    trialEndsAt: '2030-01-01T00:00:00.000Z',
    isActive: true,
    ...overrides,
  };
}

function mountProfileForm(initialData = profile()) {
  const wrapper = mount(ProfileForm, {
    props: { initialData },
    attachTo: document.body,
  });
  mountedWrappers.push(wrapper);
  return wrapper;
}

function optionLabel(option: { text: () => string }) {
  return option
    .text()
    .replace(/\s*check$/, '')
    .trim();
}

beforeEach(() => {
  vi.stubGlobal('reactive', reactive);
  vi.stubGlobal('watch', watch);
});

afterEach(() => {
  mountedWrappers.splice(0).forEach((wrapper) => wrapper.unmount());
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});

describe('ProfileForm phone input', () => {
  it('submits the E.164 phone value from the default Mexican lada selector', async () => {
    const wrapper = mountProfileForm();
    const phoneField = wrapper.get('#profile-phone');

    expect(wrapper.get('label[for="profile-phone"]').text()).toContain('Teléfono');
    expect(document.getElementById('profile-phone')).toBe(phoneField.element);

    await phoneField.setValue('55 1234 5678');
    await wrapper.get('form').trigger('submit');

    expect(wrapper.emitted('submit')?.[0]?.[0]).toMatchObject({ phone: '+525512345678' });
  });

  it('preloads an existing US E.164 phone as the US lada and national digits', () => {
    const wrapper = mountProfileForm(profile({ phone: '+14155551234' }));
    const countryTrigger = wrapper.get('#profile-phone-country');

    expect(countryTrigger.text()).toContain('🇺🇸 Estados Unidos +1');
    expect((wrapper.get('#profile-phone').element as HTMLInputElement).value).toBe('4155551234');
  });
});

describe('ProfileForm time zone listbox', () => {
  it('keeps the timezone label association and emits a selected valid zone', async () => {
    const wrapper = mountProfileForm();
    const timezoneTrigger = wrapper.get('#profile-timezone');

    expect(wrapper.get('label[for="profile-timezone"]').text()).toBe('Zona horaria');
    expect(timezoneTrigger.attributes('aria-haspopup')).toBe('listbox');
    expect(document.getElementById('profile-timezone')).toBe(timezoneTrigger.element);

    await timezoneTrigger.trigger('click');
    const options = wrapper.findAll('#profile-timezone-listbox [role="option"]');
    expect(options.map(optionLabel)).toEqual([
      'Centro (America/Mexico_City)',
      'Noreste (America/Monterrey)',
      'Noroeste / Pacífico (America/Tijuana)',
      'Sureste (America/Cancun)',
      'Montaña (America/Chihuahua)',
      'Sonora (America/Hermosillo)',
    ]);

    const tijuanaOption = options.find((option) => optionLabel(option).includes('America/Tijuana'));
    expect(tijuanaOption, 'Expected the Tijuana timezone option').toBeDefined();
    await tijuanaOption!.trigger('click');
    await wrapper.get('form').trigger('submit');

    expect(wrapper.emitted('submit')?.[0]?.[0]).toMatchObject({ timezone: 'America/Tijuana' });
  });
});
