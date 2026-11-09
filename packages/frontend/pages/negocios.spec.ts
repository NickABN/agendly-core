// @vitest-environment jsdom
import { flushPromises, mount, RouterLinkStub, type VueWrapper } from '@vue/test-utils';
import { computed, onMounted, ref, watch } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DirectoryPage from './negocios.vue';

type Business = {
  name: string;
  slug: string;
  logoUrl: string | null;
  address: string | null;
};

let get: ReturnType<typeof vi.fn>;
const wrappers: VueWrapper[] = [];

function mountPage() {
  const wrapper = mount(DirectoryPage, {
    global: { components: { NuxtLink: RouterLinkStub } },
  });
  wrappers.push(wrapper);
  return wrapper;
}

beforeEach(() => {
  get = vi.fn().mockResolvedValue({ businesses: [] });
  vi.stubGlobal('computed', computed);
  vi.stubGlobal('onMounted', onMounted);
  vi.stubGlobal('ref', ref);
  vi.stubGlobal('watch', watch);
  vi.stubGlobal('useApi', () => ({ get }));
  vi.stubGlobal('useHead', vi.fn());
  vi.stubGlobal('useSeoMeta', vi.fn());
  vi.stubGlobal('definePageMeta', vi.fn());
});

afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount());
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('public business directory page', () => {
  it('shows an accessible search input and cards linking to each public booking page', async () => {
    const businesses: Business[] = [
      {
        name: 'Salón Calma',
        slug: 'salon-calma',
        logoUrl: 'https://cdn.example/logo.webp',
        address: 'Av. Reforma 1, Ciudad de México',
      },
      { name: 'Estudio Luna', slug: 'estudio-luna', logoUrl: null, address: null },
    ];
    get.mockResolvedValue({ businesses });

    const wrapper = mountPage();
    await flushPromises();

    const label = wrapper.get('label');
    const input = wrapper.get('input');
    expect(label.text().trim()).toBe('Buscar por nombre o zona');
    expect(input.attributes('id')).toBe(label.attributes('for'));
    expect(wrapper.text()).toContain('Salón Calma');
    expect(wrapper.text()).toContain('Av. Reforma 1, Ciudad de México');
    expect(wrapper.findAllComponents(RouterLinkStub).map((link) => link.props('to'))).toEqual([
      '/salon-calma',
      '/estudio-luna',
    ]);
  });

  it('shows the directory-wide and search-specific empty states', async () => {
    const wrapper = mountPage();
    await flushPromises();

    expect(wrapper.text()).toContain('Aún no hay negocios en el directorio.');

    await wrapper.get('input').setValue('Luna');
    await new Promise((resolve) => setTimeout(resolve, 350));
    await flushPromises();

    expect(wrapper.text()).toContain('Aún no hay negocios con ese nombre.');
  });

  it('debounces search and requests the directory with q', async () => {
    vi.useFakeTimers();
    const wrapper = mountPage();
    await flushPromises();
    const initialCallCount = get.mock.calls.length;

    await wrapper.get('input').setValue('Luna');
    await vi.advanceTimersByTimeAsync(299);
    expect(get).toHaveBeenCalledTimes(initialCallCount);

    await vi.advanceTimersByTimeAsync(1);
    await flushPromises();

    expect(get).toHaveBeenCalledWith('/public/directory?q=Luna');
  });

  it('exposes a loading status while the directory request is pending', () => {
    get.mockReturnValue(new Promise(() => undefined));

    const wrapper = mountPage();

    expect(wrapper.find('[role="status"]').exists()).toBe(true);
  });

  it('shows the specified error state when loading fails', async () => {
    get.mockRejectedValue(new Error('API unavailable'));

    const wrapper = mountPage();
    await flushPromises();

    expect(wrapper.get('[role="alert"]').text()).toContain(
      'No pudimos cargar el directorio. Intenta de nuevo.',
    );
  });
});
