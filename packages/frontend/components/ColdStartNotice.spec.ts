// @vitest-environment jsdom
import { mount, type VueWrapper } from '@vue/test-utils';
import { computed, ref, type Ref } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ColdStartNotice from './ColdStartNotice.vue';
import type { ColdStartPhase } from '../composables/useColdStartNotice';

let phase: Ref<ColdStartPhase>;
let dismiss: ReturnType<typeof vi.fn>;
let mountedWrappers: VueWrapper[] = [];

function mountNotice(initialPhase: ColdStartPhase) {
  phase = ref(initialPhase);
  dismiss = vi.fn(() => {
    phase.value = 'hidden';
  });
  const wrapper = mount(ColdStartNotice);
  mountedWrappers.push(wrapper);
  return wrapper;
}

beforeEach(() => {
  mountedWrappers = [];
  vi.stubGlobal('computed', computed);
  vi.stubGlobal('useColdStartNotice', () => ({ phase, dismiss }));
});

afterEach(() => {
  mountedWrappers.forEach((wrapper) => wrapper.unmount());
  vi.unstubAllGlobals();
});

describe('ColdStartNotice', () => {
  it.each([
    ['hidden', null, []],
    ['waking', 'Despertando el servidor…', []],
    ['failed-read', 'El servidor sigue despertando', ['Cerrar aviso', 'Reintentar']],
    ['failed-write', 'Tu acción no se confirmó', ['Cerrar aviso', 'Entendido']],
  ] as const)(
    'renders the %s phase with its matching content and actions',
    (initial, title, actions) => {
      const wrapper = mountNotice(initial);
      const status = wrapper.find('[role="status"]');

      if (initial === 'hidden') {
        expect(status.exists()).toBe(false);
        expect(wrapper.text()).toBe('');
        return;
      }

      expect(status.exists()).toBe(true);
      expect(status.attributes('aria-live')).toBe('polite');
      expect(status.text()).toContain(title);
      expect(
        wrapper
          .findAll('button')
          .map((button) => button.attributes('aria-label') ?? button.text().trim()),
      ).toEqual(actions);

      if (initial === 'waking') {
        expect(wrapper.find('.animate-pulse').exists()).toBe(true);
        expect(wrapper.find('button').exists()).toBe(false);
      } else {
        expect(wrapper.get('button[aria-label="Cerrar aviso"]').attributes('type')).toBe('button');
      }
    },
  );

  it('dismisses the failed-read notice and reloads when Reintentar is activated', async () => {
    const wrapper = mountNotice('failed-read');
    const reload = vi.fn();
    const windowWithReload = new Proxy(window, {
      get(target, property) {
        if (property === 'location') return { reload };
        return Reflect.get(target, property, target);
      },
    });
    vi.stubGlobal('window', windowWithReload);
    const retryButton = wrapper
      .findAll('button')
      .find((button) => button.text().trim() === 'Reintentar');

    expect(retryButton).toBeDefined();
    await retryButton!.trigger('click');

    expect(dismiss).toHaveBeenCalledTimes(1);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('dismisses a failed-write notice when Entendido is activated', async () => {
    const wrapper = mountNotice('failed-write');

    const acknowledgeButton = wrapper
      .findAll('button')
      .find((button) => button.text().trim() === 'Entendido');

    expect(acknowledgeButton).toBeDefined();
    await acknowledgeButton!.trigger('click');
    expect(dismiss).toHaveBeenCalledTimes(1);
  });

  it('dismisses a failed-write notice from the accessible close control', async () => {
    const wrapper = mountNotice('failed-write');

    await wrapper.get('button[aria-label="Cerrar aviso"]').trigger('click');

    expect(dismiss).toHaveBeenCalledTimes(1);
  });
});
