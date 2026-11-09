// @vitest-environment jsdom
import { mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import App from './app.vue';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('app root', () => {
  it('mounts the toaster so save feedback is visible on every page', () => {
    vi.stubGlobal('useAppToast', () => ({
      toasts: ref([{ id: 't1', kind: 'success', message: 'Cambios guardados.' }]),
      remove: vi.fn(),
    }));

    const wrapper = mount(App, {
      global: { stubs: { NuxtLayout: true, NuxtPage: true, ColdStartNotice: true } },
    });

    expect(wrapper.find('[aria-live="polite"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('Cambios guardados.');
  });
});
