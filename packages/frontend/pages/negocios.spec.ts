// @vitest-environment jsdom
import {
  flushPromises,
  mount,
  RouterLinkStub,
  type DOMWrapper,
  type VueWrapper,
} from '@vue/test-utils';
import { computed, onMounted, ref, watch } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DirectoryPage from './negocios.vue';

type Business = {
  name: string;
  slug: string;
  logoUrl: string | null;
  bannerUrl: string | null;
  address: string | null;
};

const salonBusiness: Business = {
  name: 'Salón Calma',
  slug: 'salon-calma',
  logoUrl: 'https://cdn.example/logo.webp',
  bannerUrl: 'https://cdn.example/banner.webp',
  address: 'Av. Reforma 1, Ciudad de México',
};

const lunaBusiness: Business = {
  name: 'Estudio Luna',
  slug: 'estudio-luna',
  logoUrl: null,
  bannerUrl: null,
  address: null,
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

function findCover(wrapper: DOMWrapper<Element>) {
  return wrapper.findAll('[class]').find((element) => {
    const classes = element.attributes('class') ?? '';
    return classes.includes('aspect-[3/1]');
  });
}

function containsImage(wrapper: DOMWrapper<Element>, src: string) {
  return (
    (wrapper.element.tagName === 'IMG' && wrapper.attributes('src') === src) ||
    wrapper.findAll('img').some((image) => image.attributes('src') === src)
  );
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
    const businesses: Business[] = [salonBusiness, lunaBusiness];
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

  it('renders a banner image in the directory card cover when one is available', async () => {
    get.mockResolvedValue({ businesses: [salonBusiness] });
    const wrapper = mountPage();
    await flushPromises();

    const salonCard = wrapper.find('li');
    const salonCover = findCover(salonCard);
    expect(salonCover).toBeDefined();
    expect(containsImage(salonCover!, 'https://cdn.example/banner.webp')).toBe(true);
  });

  it('renders a branded gradient cover when the directory business has no banner', async () => {
    get.mockResolvedValue({ businesses: [lunaBusiness] });
    const wrapper = mountPage();
    await flushPromises();

    const lunaCover = findCover(wrapper.find('li'));
    expect(lunaCover).toBeDefined();
    const placeholderClasses = [
      lunaCover!.attributes('class') ?? '',
      ...lunaCover!.findAll('[class]').map((element) => element.attributes('class') ?? ''),
    ].join(' ');
    expect(placeholderClasses).toMatch(/(?:bg-gradient|bg-linear)-/);
    expect(placeholderClasses).toContain('var(--color-primary)');
    expect(placeholderClasses).toContain('var(--color-primary-container)');
  });

  it('shows a logo when available and initials when a business has no logo', async () => {
    get.mockResolvedValue({ businesses: [salonBusiness, lunaBusiness] });
    const wrapper = mountPage();
    await flushPromises();

    const [salonCard, lunaCard] = wrapper.findAll('li');
    expect(salonCard).toBeDefined();
    expect(lunaCard).toBeDefined();
    expect(
      salonCard!.findAll('img').some((image) => image.attributes('src') === salonBusiness.logoUrl),
    ).toBe(true);
    expect(
      lunaCard!.findAll('img').some((image) => image.attributes('alt') === 'Logo de Estudio Luna'),
    ).toBe(false);
    expect(
      lunaCard!.findAll('[aria-hidden="true"]').some((element) => element.text().trim() === 'EL'),
    ).toBe(true);
  });
});
