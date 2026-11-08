// @vitest-environment jsdom

import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { computed, defineComponent, h, nextTick, onMounted, ref, Suspense } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

type Booking = Awaited<ReturnType<typeof usePublicBooking>>;
const mountedPages: VueWrapper[] = [];

async function mountBookingPage(booking: Booking) {
  vi.stubGlobal('computed', computed);
  vi.stubGlobal('onMounted', onMounted);
  vi.stubGlobal('definePageMeta', vi.fn());
  vi.stubGlobal('useRoute', () => ({ params: { slug: 'salon-calma' } }));
  vi.stubGlobal('useSeoMeta', vi.fn());
  vi.stubGlobal('usePublicBooking', async () => booking);
  vi.stubGlobal('getInitials', (name: string) => name.slice(0, 1));

  const parent = defineComponent({
    setup: () => () =>
      h(Suspense, null, {
        default: () => h(PublicBookingPage),
        fallback: () => h('div'),
      }),
  });
  const wrapper = mount(parent, {
    attachTo: document.body,
    global: {
      stubs: {
        BookingConfirmationScreen: true,
        BookingProgressBar: true,
        BookingServiceCard: true,
        BookingEmployeeSelector: true,
        BookingDayTabs: true,
        BookingSlotGrid: true,
        NuxtLink: true,
      },
    },
  });
  mountedPages.push(wrapper);
  await flushPromises();
  await nextTick();
  return wrapper;
}

function optionLabel(option: { text: () => string }) {
  return option
    .text()
    .replace(/\s*check$/, '')
    .trim();
}

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

describe('usePublicBooking phone validation', () => {
  const tenantPayload = {
    tenant: { name: 'Salón Calma', slug: 'salon-calma', timezone: 'America/Mexico_City' },
    services: [{ id: 'svc-1', name: 'Corte', durationMinutes: 60, priceMXN: '200' }],
    employees: [{ id: 'emp-1', name: 'María', serviceIds: ['svc-1'] }],
  };

  beforeEach(() => {
    fetchMock.mockReset();
    tenantStatus = ref('success');
    tenantData = ref(null);
    tenantError = ref(null);
    useAsyncDataMock.mockReset();
    useAsyncDataMock.mockImplementation(async (_key: string, handler: () => Promise<unknown>) => {
      tenantData.value = await handler();
      return {
        data: tenantData,
        error: tenantError,
        status: tenantStatus,
        refresh: refreshTenantMock,
      };
    });
  });

  async function setupBooking() {
    fetchMock.mockResolvedValueOnce(tenantPayload); // tenant fetch
    const b = await usePublicBooking('salon-calma');
    b.selectedServiceId.value = 'svc-1';
    b.selectedEmployeeId.value = 'emp-1';
    b.selectedSlot.value = '2030-06-10T16:00:00.000Z';
    b.clientForm.name = 'Ana López';
    b.clientForm.privacyAccepted = true;
    return b;
  }

  async function setupBookingForm() {
    const booking = await setupBooking();
    booking.step.value = 4;
    booking.selectedDate.value = '2030-06-10';
    return { booking, wrapper: await mountBookingPage(booking) };
  }

  afterEach(() => {
    mountedPages.splice(0).forEach((wrapper) => wrapper.unmount());
    document.body.replaceChildren();
  });

  it('blocks submit and shows the friendly message for an invalid phone', async () => {
    const b = await setupBooking();
    b.clientForm.phone = '12345';
    fetchMock.mockClear(); // ignore the tenant fetch

    await b.submitBooking();

    expect(b.error.value).toBe('El teléfono no es válido');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(b.confirmation.value).toBeNull();
  });

  it('normalizes a loose MX phone to E.164 in the request body before submit', async () => {
    const b = await setupBooking();
    b.clientForm.phone = '55 1234 5678';
    fetchMock.mockClear();
    fetchMock.mockResolvedValueOnce({ id: 'appt-1' }); // booking POST

    await b.submitBooking();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, options] = fetchMock.mock.calls[0];
    expect(options.body.clientPhone).toBe('+525512345678');
    expect(b.error.value).toBe('');
  });

  it('accepts an international phone and sends it as E.164 in the request body', async () => {
    const b = await setupBooking();
    b.clientForm.phone = '+1 415 555 1234';
    fetchMock.mockClear();
    fetchMock.mockResolvedValueOnce({ id: 'appt-1' }); // booking POST

    await b.submitBooking();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, options] = fetchMock.mock.calls[0];
    expect(options.body.clientPhone).toBe('+14155551234');
    expect(b.error.value).toBe('');
  });

  it('submits the E.164 value from the default Mexican lada in the booking form', async () => {
    const { booking, wrapper } = await setupBookingForm();
    const phoneField = wrapper.get('#client-phone');
    await phoneField.setValue('55 1234 5678');

    expect(booking.clientForm.phone).toBe('+525512345678');

    fetchMock.mockClear();
    fetchMock.mockResolvedValueOnce({ id: 'appt-1' });
    await wrapper.get('form').trigger('submit');
    await flushPromises();

    const [, options] = fetchMock.mock.calls[0] ?? [];
    expect(options?.body.clientPhone).toBe('+525512345678');
  });

  it('submits a Spanish E.164 value after selecting España in the booking form', async () => {
    const { wrapper } = await setupBookingForm();
    const countrySelector = wrapper.get('[aria-haspopup="listbox"]');

    await countrySelector.trigger('click');
    const spainOption = wrapper
      .findAll('[role="option"]')
      .find((option) => optionLabel(option).includes('🇪🇸 España +34'));
    expect(spainOption, 'Expected the España country option').toBeDefined();
    await spainOption!.trigger('click');
    await wrapper.get('#client-phone').setValue('61 2345 678');

    fetchMock.mockClear();
    fetchMock.mockResolvedValueOnce({ id: 'appt-1' });
    await wrapper.get('form').trigger('submit');
    await flushPromises();

    const [, options] = fetchMock.mock.calls[0] ?? [];
    expect(options?.body.clientPhone).toBe('+34612345678');
  });

  it('shows the invalid-phone message and does not submit the booking', async () => {
    const { wrapper } = await setupBookingForm();
    const countrySelector = wrapper.get('[aria-haspopup="listbox"]');

    await countrySelector.trigger('click');
    const spainOption = wrapper
      .findAll('[role="option"]')
      .find((option) => optionLabel(option).includes('🇪🇸 España +34'));
    expect(spainOption, 'Expected the España country option').toBeDefined();
    await spainOption!.trigger('click');
    await wrapper.get('#client-phone').setValue('12-34');

    fetchMock.mockClear();
    await wrapper.get('form').trigger('submit');
    await flushPromises();

    expect(wrapper.get('[role="alert"]').text()).toContain('El teléfono no es válido');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
