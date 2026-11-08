// @vitest-environment jsdom

import { flushPromises, mount } from '@vue/test-utils';
import { computed, defineComponent, h, nextTick, onMounted, ref, Suspense } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PublicBookingPage from '../pages/[slug].vue';

const fetchMock = vi.fn();
const createErrorMock = vi.fn((options: Record<string, unknown>) =>
  Object.assign(new Error(String(options.statusMessage)), options),
);
const useAsyncDataMock = vi.fn();
const refreshTenantMock = vi.fn(async () => undefined);
let tenantStatus = ref('idle');
let tenantData = ref<unknown>(null);
let tenantError = ref<unknown>(null);

vi.stubGlobal('$fetch', fetchMock);
vi.stubGlobal('useRuntimeConfig', () => ({ public: { apiUrl: 'https://api.example.test' } }));
vi.stubGlobal('apiBase', () => 'https://api.example.test');
vi.stubGlobal('useAsyncData', useAsyncDataMock);
vi.stubGlobal('createError', createErrorMock);
vi.stubGlobal('useAvailability', () => ({
  slots: ref([]),
  loading: ref(false),
  fetchSlots: vi.fn(),
  reset: vi.fn(),
}));

const { publicTenantFetchOptions, usePublicBooking } = await import('./usePublicBooking');

describe('usePublicBooking cold-start integration', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    createErrorMock.mockClear();
    refreshTenantMock.mockClear();
    tenantStatus = ref('idle');
    tenantData = ref(null);
    tenantError = ref(null);
    useAsyncDataMock.mockReset();
    useAsyncDataMock.mockImplementation(async (_key: string, handler: () => Promise<unknown>) => {
      try {
        tenantData.value = await handler();
        tenantStatus.value = 'success';
        tenantError.value = null;
      } catch (error) {
        tenantData.value = null;
        tenantStatus.value = 'error';
        tenantError.value = error;
      }
      return {
        data: tenantData,
        error: tenantError,
        status: tenantStatus,
        refresh: refreshTenantMock,
      };
    });
  });

  it('normalizes a cold-start response for SSR and exposes retry state', async () => {
    fetchMock.mockRejectedValue(
      Object.assign(new Error('Service Unavailable'), {
        statusCode: 503,
        response: { status: 503 },
      }),
    );

    const booking = await usePublicBooking('salon-calma');

    expect(publicTenantFetchOptions(true)).toEqual({ timeout: 8000, retry: 0 });
    expect(fetchMock).toHaveBeenCalledWith('https://api.example.test/public/salon-calma', {
      retry: 0,
    });
    expect(createErrorMock).toHaveBeenCalledWith({
      statusCode: 503,
      statusMessage: 'Backend waking up',
      data: { coldStart: true, statusCode: 503 },
    });
    expect(booking.fetchError.value).toMatchObject({
      statusCode: 503,
      data: { coldStart: true, statusCode: 503 },
    });
    expect(booking.serverWaking.value).toBe(true);
    expect(booking.retryingTenant.value).toBe(false);

    tenantStatus.value = 'pending';
    expect(booking.retryingTenant.value).toBe(true);
    await booking.retryTenant();
    expect(refreshTenantMock).toHaveBeenCalledTimes(1);
    tenantStatus.value = 'error';
    expect(booking.retryingTenant.value).toBe(false);
  });

  it('retries the SSR cold-start tenant fetch on mount in the browser', async () => {
    const retryTenant = vi.fn();
    const booking = {
      confirmation: ref(null),
      fetchError: ref({ statusCode: 503 }),
      serverWaking: ref(true),
      retryingTenant: ref(false),
      retryTenant,
      tenantName: ref('Salón Calma'),
    };

    vi.stubGlobal('computed', computed);
    vi.stubGlobal('onMounted', onMounted);
    vi.stubGlobal('definePageMeta', vi.fn());
    vi.stubGlobal('useRoute', () => ({ params: { slug: 'salon-calma' } }));
    vi.stubGlobal('useSeoMeta', vi.fn());
    vi.stubGlobal('usePublicBooking', async () => booking);

    const parent = defineComponent({
      setup: () => () =>
        h(Suspense, null, {
          default: () => h(PublicBookingPage),
          fallback: () => h('div'),
        }),
    });
    const wrapper = mount(parent);

    await flushPromises();
    await nextTick();

    expect(retryTenant).toHaveBeenCalledTimes(1);
    wrapper.unmount();
  });
});
