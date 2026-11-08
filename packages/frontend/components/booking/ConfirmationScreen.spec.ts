// @vitest-environment jsdom

import { mount } from '@vue/test-utils';
import { computed } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ConfirmationScreen from './ConfirmationScreen.vue';

const booking = {
  id: 'appointment-123456',
  startTime: '2026-06-12T17:00:00.000Z',
  endTime: '2026-06-12T17:45:00.000Z',
};

const business = {
  name: 'Estudio Luna',
  logoUrl: 'https://cdn.example.test/luna-logo.webp',
  bannerUrl: 'https://cdn.example.test/luna-banner.webp',
  address: 'Av. Vallarta 123, Guadalajara',
  phone: '+52 33 1234 5678',
  latitude: 20.6736,
  longitude: -103.344,
};

function mountConfirmation(
  tenantInfo: Record<string, unknown>,
  tenantName = String(tenantInfo.name ?? ''),
) {
  return mount(ConfirmationScreen, {
    props: {
      booking,
      serviceName: 'Manicure',
      employeeName: 'Ana López',
      tenantName,
      tenantInfo,
    } as never,
    global: {
      mocks: {
        getInitials: (name: string) => name.slice(0, 1),
        colorForName: () => 'bg-blue-500',
      },
    },
  });
}

function mapsLink(wrapper: ReturnType<typeof mount>) {
  return wrapper
    .findAll('a')
    .find((link) => link.attributes('href')?.startsWith('https://www.google.com/maps/search/'));
}

beforeEach(() => {
  vi.stubGlobal('computed', computed);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('booking confirmation business information', () => {
  it('renders the logo and banner when configured', () => {
    const wrapper = mountConfirmation(business);

    expect(wrapper.findAll('img').map((image) => image.attributes('src'))).toEqual(
      expect.arrayContaining([business.logoUrl, business.bannerUrl]),
    );
  });

  it('renders the business name provided with its confirmation information', () => {
    const wrapper = mountConfirmation(business, '');

    expect(wrapper.text()).toContain('Estudio Luna');
  });

  it('links the business address to its configured coordinates', () => {
    const wrapper = mountConfirmation(business);
    const directions = mapsLink(wrapper);

    expect(directions).toBeDefined();
    expect(directions?.text()).toContain('Cómo llegar');
    expect(new URL(directions!.attributes('href')!).searchParams.get('query')).toBe(
      `${business.latitude},${business.longitude}`,
    );
  });

  it('renders the stored phone number as a telephone link', () => {
    const wrapper = mountConfirmation(business);
    const phone = wrapper.get('a[href="tel:+52 33 1234 5678"]');

    expect(phone.text()).toContain(business.phone);
  });

  it.each([
    ['both coordinates are absent', null, null],
    ['latitude is absent', null, business.longitude],
    ['longitude is absent', business.latitude, null],
  ])('uses the encoded address when %s', (_condition, latitude, longitude) => {
    const address = 'Calle Niños Héroes 15, Guadalajara';
    const wrapper = mountConfirmation({
      ...business,
      latitude,
      longitude,
      address,
    });
    const directions = mapsLink(wrapper);

    expect(directions).toBeDefined();
    expect(new URL(directions!.attributes('href')!).searchParams.get('query')).toBe(address);
  });

  it('omits image, map, and phone blocks when those business details are absent', () => {
    const wrapper = mountConfirmation({
      name: 'Estudio Luna',
      logoUrl: null,
      bannerUrl: null,
      address: null,
      phone: null,
      latitude: null,
      longitude: null,
    });

    expect(wrapper.text()).toContain('Estudio Luna');
    expect(wrapper.findAll('img')).toHaveLength(0);
    expect(mapsLink(wrapper)).toBeUndefined();
    expect(wrapper.find('a[href^="tel:"]').exists()).toBe(false);
  });
});
