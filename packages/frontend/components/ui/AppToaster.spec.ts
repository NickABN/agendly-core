// @vitest-environment jsdom
import { mount, type VueWrapper } from '@vue/test-utils';
import { ref, type Ref } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AppToaster from './AppToaster.vue';

type Toast = { id: string; kind: 'success' | 'error'; message: string };

let toasts: Ref<Toast[]>;
let wrapper: VueWrapper | undefined;
const removeToast = vi.fn((id: string) => {
  toasts.value = toasts.value.filter((toast) => toast.id !== id);
});

beforeEach(() => {
  toasts = ref([
    { id: 'success-1', kind: 'success', message: 'Cambios guardados.' },
    { id: 'error-1', kind: 'error', message: 'No se pudo guardar.' },
  ]);
  removeToast.mockClear();
  vi.stubGlobal('useAppToast', () => ({ toasts, remove: removeToast }));
});

afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  vi.unstubAllGlobals();
});

describe('AppToaster', () => {
  it('renders toast messages in a polite live region and marks errors as alerts', () => {
    wrapper = mount(AppToaster);

    expect(wrapper.get('[aria-live="polite"]').text()).toContain('Cambios guardados.');
    expect(wrapper.get('[role="alert"]').text()).toContain('No se pudo guardar.');
    expect(wrapper.text()).toContain('Cambios guardados.');
  });

  it('removes a toast when its accessible close button is activated', async () => {
    wrapper = mount(AppToaster);

    await wrapper.get('[role="alert"] button[aria-label="Cerrar aviso"]').trigger('click');

    expect(removeToast).toHaveBeenCalledWith('error-1');
    expect(toasts.value.map(({ message }) => message)).toEqual(['Cambios guardados.']);
    expect(wrapper.text()).not.toContain('No se pudo guardar.');
  });
});
