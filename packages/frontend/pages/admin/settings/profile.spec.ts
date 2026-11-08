// @vitest-environment jsdom
import { flushPromises, mount, RouterLinkStub, type VueWrapper } from '@vue/test-utils';
import {
  computed,
  defineComponent,
  h,
  onMounted,
  onUnmounted,
  reactive,
  ref,
  Suspense,
  watch,
} from 'vue';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ProfileSettingsPage from './profile.vue';

const routeMocks = vi.hoisted(() => ({
  useProfileStore: vi.fn(),
  useAuthStore: vi.fn(),
}));

vi.mock('~/stores/profile', () => ({ useProfileStore: routeMocks.useProfileStore }));
vi.mock('~/stores/auth', () => ({ useAuthStore: routeMocks.useAuthStore }));

const Stub = defineComponent({ setup: () => () => h('div') });
const SuspenseHost = defineComponent({
  setup: () => () =>
    h(Suspense, null, {
      default: () => h(ProfileSettingsPage),
      fallback: () => h('div'),
    }),
});
const wrappers: VueWrapper[] = [];

function mountProfileRoute(role: 'OWNER' | 'ADMIN') {
  vi.stubGlobal('ref', ref);
  vi.stubGlobal('computed', computed);
  vi.stubGlobal('reactive', reactive);
  vi.stubGlobal('watch', watch);
  vi.stubGlobal('onMounted', onMounted);
  vi.stubGlobal('onUnmounted', onUnmounted);
  vi.stubGlobal('definePageMeta', vi.fn());

  const navigateTo = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal('navigateTo', navigateTo);

  routeMocks.useProfileStore.mockReturnValue(
    reactive({
      profileData: null,
      imageHistory: [],
      loading: true,
      error: null,
      geocodingWarning: null,
      fetchProfile: vi.fn().mockResolvedValue(undefined),
      fetchImageHistory: vi.fn().mockResolvedValue(undefined),
      saveProfile: vi.fn().mockResolvedValue(undefined),
      saveLocation: vi.fn().mockResolvedValue(undefined),
    }),
  );
  routeMocks.useAuthStore.mockReturnValue({ user: { role } });

  const wrapper = mount(SuspenseHost, {
    global: {
      components: {
        NuxtLink: RouterLinkStub,
        ProfileForm: Stub,
        ProfileImageUpload: Stub,
        ProfileImageHistory: Stub,
        ProfileLocationForm: Stub,
      },
    },
  });
  wrappers.push(wrapper);
  return { wrapper, navigateTo };
}

afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount());
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('/admin/settings/profile compatibility route', () => {
  it.each(['OWNER', 'ADMIN'] as const)(
    'redirects a business %s to the unified image settings tab',
    async (role) => {
      const { wrapper, navigateTo } = mountProfileRoute(role);
      await flushPromises();

      expect(navigateTo).toHaveBeenCalled();
      const target = navigateTo.mock.calls[0][0];
      if (typeof target === 'string') {
        expect(target).toBe('/admin/config?tab=imagenes');
      } else {
        expect(target).toMatchObject({
          path: '/admin/config',
          query: { tab: 'imagenes' },
        });
      }
      expect(wrapper.text()).not.toContain('Perfil del negocio');
    },
  );
});
