// @vitest-environment jsdom
import { mount } from '@vue/test-utils';
import { afterEach, describe, expect, it } from 'vitest';
import OnboardingSelect from './OnboardingSelect.vue';

afterEach(() => {
  document.body.innerHTML = '';
});

describe('OnboardingSelect (AppSelect wrapper)', () => {
  it('forwards id, options and the typed value to AppSelect', async () => {
    const wrapper = mount(OnboardingSelect, {
      props: {
        id: 'service-duration',
        modelValue: 30,
        options: [
          { value: 30, label: '30 min' },
          { value: 60, label: '1 h' },
        ],
      },
      attachTo: document.body,
    });

    const trigger = wrapper.get('#service-duration');
    expect(trigger.attributes('aria-haspopup')).toBe('listbox');
    expect(trigger.text()).toContain('30 min');

    await trigger.trigger('click');
    const option = wrapper.findAll('[role="option"]').find((item) => item.text().includes('1 h'));
    await option!.trigger('click');

    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([60]);
    wrapper.unmount();
  });

  it('forwards disabled so the list cannot open', async () => {
    const wrapper = mount(OnboardingSelect, {
      props: {
        id: 'role',
        modelValue: 'a',
        options: [{ value: 'a', label: 'A' }],
        disabled: true,
      },
      attachTo: document.body,
    });

    await wrapper.get('#role').trigger('click');

    expect(wrapper.find('[role="listbox"]').exists()).toBe(false);
    wrapper.unmount();
  });
});
