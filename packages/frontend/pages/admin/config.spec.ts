// @vitest-environment jsdom
import { flushPromises, mount, RouterLinkStub, type VueWrapper } from '@vue/test-utils';
import { computed, defineComponent, h, onMounted, onUnmounted, reactive, ref, watch } from 'vue';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ConfigPage from './config.vue';

const pageMocks = vi.hoisted(() => ({
  useProfileStore: vi.fn(),
  useAuthStore: vi.fn(),
}));

vi.mock('~/stores/profile', () => ({ useProfileStore: pageMocks.useProfileStore }));
vi.mock('~/stores/auth', () => ({ useAuthStore: pageMocks.useAuthStore }));

const ProfileFormStub = defineComponent({
  name: 'ProfileForm',
  setup: () => () => h('div', { 'data-test': 'profile-form' }, 'Nombre Teléfono Zona horaria'),
});

const ProfileImageUploadStub = defineComponent({
  name: 'ProfileImageUpload',
  setup: () => () => h('div', { 'data-test': 'image-upload' }, 'Subir imagen'),
});

const ProfileImageHistoryStub = defineComponent({
  name: 'ProfileImageHistory',
  setup: () => () => h('div', { 'data-test': 'image-history' }, 'Historial de imágenes'),
});

const ProfileLocationFormStub = defineComponent({
  name: 'ProfileLocationForm',
  setup: () => () => h('div', { 'data-test': 'location-form' }, 'Mapa de ubicación'),
});

type Harness = {
  wrapper: VueWrapper;
  route: { query: Record<string, string | undefined> };
  router: { replace: ReturnType<typeof vi.fn>; push: ReturnType<typeof vi.fn> };
  clipboardWriteText: ReturnType<typeof vi.fn>;
};

const mountedWrappers: VueWrapper[] = [];
const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');

function mountConfigPage(tab?: string): Harness {
  vi.stubGlobal('ref', ref);
  vi.stubGlobal('computed', computed);
  vi.stubGlobal('reactive', reactive);
  vi.stubGlobal('watch', watch);
  vi.stubGlobal('onMounted', onMounted);
  vi.stubGlobal('onUnmounted', onUnmounted);
  vi.stubGlobal('definePageMeta', vi.fn());

  const route = reactive<{ query: Record<string, string | undefined> }>({
    query: tab ? { tab } : {},
  });
  const applyRouteLocation = vi.fn(async (location: unknown) => {
    if (typeof location === 'string') {
      const query = Object.fromEntries(new URL(location, 'https://agendly.mx').searchParams);
      route.query = { ...route.query, ...query };
    } else if (location && typeof location === 'object' && 'query' in location) {
      route.query = { ...route.query, ...(location as { query: Record<string, string> }).query };
    }
  });
  const router = { replace: applyRouteLocation, push: applyRouteLocation };
  vi.stubGlobal('useRoute', () => route);
  vi.stubGlobal('useRouter', () => router);
  vi.stubGlobal('navigateTo', applyRouteLocation);

  const tenantConfig = {
    form: reactive({
      name: 'Salón Calma',
      slug: 'salon-calma',
      phone: '+525512345678',
      address: 'Av. Reforma 1, Ciudad de México',
      latitude: 19.4326,
      longitude: -99.1332,
    }),
    saving: ref(false),
    saved: ref(false),
    logoFile: ref<File | null>(null),
    logoUploading: ref(false),
    logoSrc: computed(() => null),
    mapSrc: computed(() => null),
    load: vi.fn().mockResolvedValue(undefined),
    save: vi.fn().mockResolvedValue(undefined),
    onLogoSelect: vi.fn(),
    uploadLogo: vi.fn().mockResolvedValue(undefined),
  };

  const profileStore = reactive({
    profileData: {
      id: 'tenant-1',
      name: 'Salón Calma',
      slug: 'salon-calma',
      phone: '+525512345678',
      address: 'Av. Reforma 1, Ciudad de México',
      logoUrl: null,
      bannerUrl: null,
      latitude: 19.4326,
      longitude: -99.1332,
      timezone: 'America/Mexico_City',
    },
    imageHistory: [],
    loading: false,
    error: null,
    geocodingWarning: null,
    fetchProfile: vi.fn().mockResolvedValue(undefined),
    fetchImageHistory: vi.fn().mockResolvedValue(undefined),
    saveProfile: vi.fn().mockResolvedValue(undefined),
    saveLocation: vi.fn().mockResolvedValue(undefined),
  });
  pageMocks.useProfileStore.mockReturnValue(profileStore);
  pageMocks.useAuthStore.mockReturnValue({ user: { role: 'OWNER' } });

  vi.stubGlobal('useTenantConfig', () => tenantConfig);
  vi.stubGlobal('useProfileStore', () => profileStore);
  vi.stubGlobal('useAuthStore', () => ({ user: { role: 'OWNER' } }));
  vi.stubGlobal('usePublicBookingUrl', () => ({
    bookingBaseLabel: computed(() => 'agendly.mx/'),
    bookingUrl: (slug: string) => `https://agendly.mx/${slug}`,
    bookingDisplayUrl: (slug: string) => `agendly.mx/${slug}`,
  }));

  const clipboardWriteText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: clipboardWriteText },
  });

  const wrapper = mount(ConfigPage, {
    global: {
      components: {
        NuxtLink: RouterLinkStub,
        ProfileForm: ProfileFormStub,
        ProfileImageUpload: ProfileImageUploadStub,
        ProfileImageHistory: ProfileImageHistoryStub,
        ProfileLocationForm: ProfileLocationFormStub,
      },
    },
  });
  mountedWrappers.push(wrapper);
  return { wrapper, route, router, clipboardWriteText };
}

afterEach(() => {
  mountedWrappers.splice(0).forEach((wrapper) => wrapper.unmount());
  if (originalClipboard) {
    Object.defineProperty(navigator, 'clipboard', originalClipboard);
  } else {
    Reflect.deleteProperty(navigator, 'clipboard');
  }
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('admin config settings tabs', () => {
  it('renders accessible tabs in the required order and defaults to General', async () => {
    const { wrapper } = mountConfigPage();
    await flushPromises();

    const tabs = wrapper.findAll('[role="tab"]');
    expect(tabs.map((tab) => tab.text().trim())).toEqual([
      'General',
      'Página pública',
      'Imágenes',
      'Ubicación',
    ]);
    expect(tabs.map((tab) => tab.attributes('aria-selected'))).toEqual([
      'true',
      'false',
      'false',
      'false',
    ]);
    expect(wrapper.get('h1').text()).toBe('Configuración');
  });

  it.each(['general', 'publica', 'imagenes', 'ubicacion'])(
    'deep-links to the %s section and shows its content',
    async (tabId) => {
      const { wrapper } = mountConfigPage(tabId);
      await flushPromises();

      const activeTab = wrapper.get('[role="tab"][aria-selected="true"]');
      expect(activeTab.element).toBeTruthy();

      if (tabId === 'general') {
        expect(wrapper.get('[data-test="profile-form"]').isVisible()).toBe(true);
      } else if (tabId === 'publica') {
        expect(
          wrapper
            .findAll('input')
            .some((input) => (input.element as HTMLInputElement).value === 'salon-calma'),
        ).toBe(true);
        expect(wrapper.text()).toContain('agendly.mx/salon-calma');
      } else if (tabId === 'imagenes') {
        expect(wrapper.findAll('[data-test="image-upload"]').length).toBeGreaterThanOrEqual(2);
        expect(wrapper.find('[data-test="image-history"]').exists()).toBe(true);
      } else {
        expect(wrapper.get('[data-test="location-form"]').isVisible()).toBe(true);
      }
    },
  );

  it('updates the query string and selected tab when another section is activated', async () => {
    const { wrapper, route, router } = mountConfigPage('general');
    await flushPromises();

    await wrapper
      .findAll('[role="tab"]')
      .find((tab) => tab.text().trim() === 'Ubicación')!
      .trigger('click');
    await flushPromises();

    expect(router.replace).toHaveBeenCalled();
    expect(route.query.tab).toBe('ubicacion');
    expect(wrapper.get('[role="tab"][aria-selected="true"]').text()).toBe('Ubicación');
  });

  it('falls back to General for an unsupported tab query', async () => {
    const { wrapper } = mountConfigPage('not-a-tab');
    await flushPromises();

    expect(wrapper.get('[role="tab"][aria-selected="true"]').text()).toBe('General');
  });

  it('previews the tenant public booking URL', async () => {
    const { wrapper } = mountConfigPage('publica');
    await flushPromises();

    expect(wrapper.text()).toContain('agendly.mx/salon-calma');
  });

  it('copies the public booking URL from the public-page section', async () => {
    const { wrapper, clipboardWriteText } = mountConfigPage('publica');
    await flushPromises();

    const copyButton = wrapper.findAll('button').find((button) => /copiar/i.test(button.text()));
    expect(copyButton).toBeDefined();
    await copyButton!.trigger('click');

    expect(clipboardWriteText).toHaveBeenCalledWith('https://agendly.mx/salon-calma');
  });

  it('does not expose duplicate editable coordinate inputs', async () => {
    const { wrapper } = mountConfigPage('general');
    await flushPromises();

    expect(wrapper.findAll('input[type="number"]')).toHaveLength(0);
  });

  it('does not link to the legacy image-history page', async () => {
    const { wrapper } = mountConfigPage('general');
    await flushPromises();

    expect(
      wrapper
        .findAllComponents(RouterLinkStub)
        .some((link) => link.props('to') === '/admin/settings/profile'),
    ).toBe(false);
  });
});
