// @vitest-environment jsdom
import { mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { computed } from 'vue';
import OnboardingServicesPreview from './OnboardingServicesPreview.vue';

beforeEach(() => {
  vi.stubGlobal('computed', computed);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('OnboardingServicesPreview', () => {
  it('renders real services with their formatted duration and Mexican peso price', () => {
    const wrapper = mount(OnboardingServicesPreview, {
      props: {
        services: [
          { name: 'Corte', durationMinutes: 40, priceMXN: 1500 },
          { name: 'Color', durationMinutes: 90, priceMXN: 800 },
        ],
      },
    });

    expect(wrapper.find('section[aria-label="Servicios disponibles"]').exists()).toBe(true);
    expect(wrapper.findAll('li')).toHaveLength(2);
    expect(wrapper.findAll('li')[0]?.text()).toContain('Corte');
    expect(wrapper.findAll('li')[0]?.text()).toContain('40 min');
    expect(wrapper.findAll('li')[0]?.text()).toContain('$1,500.00');
    expect(wrapper.findAll('li')[1]?.text()).toContain('Color');
    expect(wrapper.findAll('li')[1]?.text()).toContain('1 h 30 min');
    expect(wrapper.findAll('li')[1]?.text()).toContain('$800.00');

    wrapper.unmount();
  });

  it('ignores services with empty names and displays the empty state when none are visible', async () => {
    const wrapper = mount(OnboardingServicesPreview, {
      props: {
        services: [
          { name: '', durationMinutes: 30, priceMXN: 300 },
          { name: '   ', durationMinutes: 60, priceMXN: 600 },
          { name: 'Manicure', durationMinutes: 50, priceMXN: 450 },
        ],
      },
    });

    expect(wrapper.findAll('li')).toHaveLength(1);
    expect(wrapper.findAll('li')[0]?.text()).toContain('Manicure');
    expect(wrapper.find('p').text()).not.toContain('Tus servicios aparecerán aquí');

    await wrapper.setProps({
      services: [
        { name: '', durationMinutes: 30, priceMXN: 300 },
        { name: '   ', durationMinutes: 60, priceMXN: 600 },
      ],
    });
    expect(wrapper.findAll('li')).toHaveLength(0);
    expect(wrapper.text()).toContain('Tus servicios aparecerán aquí cuando agregues uno.');

    wrapper.unmount();
  });
});
