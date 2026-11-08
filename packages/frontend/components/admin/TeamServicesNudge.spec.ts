// @vitest-environment jsdom
import { mount, RouterLinkStub, type VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { computed, nextTick, onMounted, reactive, ref } from 'vue';
import TeamServicesNudge from './TeamServicesNudge.vue';

const DISMISS_KEY = 'agendly:team-services-nudge-dismissed';

let mountedWrappers: VueWrapper[] = [];

function stubStorage(store: Record<string, string>, options: { throws?: boolean } = {}) {
  const storage = {
    getItem: vi.fn((key: string) => {
      if (options.throws) throw new Error('localStorage blocked');
      return key in store ? store[key] : null;
    }),
    setItem: vi.fn((key: string, value: string) => {
      if (options.throws) throw new Error('localStorage blocked');
      store[key] = value;
    }),
  };
  vi.stubGlobal('localStorage', storage);
  return storage;
}

function mountNudge(isOnboarded: boolean) {
  const store = reactive({ isOnboarded });
  vi.stubGlobal('useAuth', () => ({ store }));
  const wrapper = mount(TeamServicesNudge, {
    global: { components: { NuxtLink: RouterLinkStub } },
  });
  mountedWrappers.push(wrapper);
  return wrapper;
}

beforeEach(() => {
  mountedWrappers = [];
  vi.stubGlobal('ref', ref);
  vi.stubGlobal('computed', computed);
  vi.stubGlobal('onMounted', onMounted);
});

afterEach(() => {
  mountedWrappers.forEach((wrapper) => wrapper.unmount());
  vi.unstubAllGlobals();
});

describe('TeamServicesNudge', () => {
  it('renders the team-services notice and a link to the staff page when onboarded', async () => {
    stubStorage({});
    const wrapper = mountNudge(true);
    await nextTick();

    expect(wrapper.text()).toContain(
      'Revisa qué servicios hace cada persona de tu equipo. Por defecto todos hacen todos los servicios.',
    );
    const link = wrapper.findComponent(RouterLinkStub);
    expect(link.exists()).toBe(true);
    expect(link.text()).toContain('Revisar equipo');
    expect(link.props('to')).toBe('/admin/staff');
  });

  it('stays hidden when the tenant is not onboarded', async () => {
    stubStorage({});
    const wrapper = mountNudge(false);
    await nextTick();

    expect(wrapper.text()).toBe('');
    expect(wrapper.findComponent(RouterLinkStub).exists()).toBe(false);
  });

  it('hides the notice and persists the dismissal when the close control is used', async () => {
    const store: Record<string, string> = {};
    const storage = stubStorage(store);
    const wrapper = mountNudge(true);
    await nextTick();

    expect(wrapper.text()).toContain('Revisa qué servicios hace cada persona de tu equipo.');

    await wrapper.get('button[aria-label="Cerrar aviso"]').trigger('click');
    await nextTick();

    expect(wrapper.text()).toBe('');
    expect(storage.setItem).toHaveBeenCalledWith(DISMISS_KEY, expect.anything());
    expect(store[DISMISS_KEY]).toBeDefined();
  });

  it('stays hidden on mount when the dismissal key already exists', async () => {
    stubStorage({ [DISMISS_KEY]: '1' });
    const wrapper = mountNudge(true);
    await nextTick();

    expect(wrapper.text()).toBe('');
  });

  it('still renders when localStorage access throws', async () => {
    stubStorage({}, { throws: true });
    const wrapper = mountNudge(true);
    await nextTick();

    expect(wrapper.text()).toContain('Revisa qué servicios hace cada persona de tu equipo.');
  });
});
