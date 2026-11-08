// @vitest-environment jsdom

import { flushPromises, mount } from '@vue/test-utils';
import { computed, defineComponent, h, nextTick, onMounted, reactive, ref, Suspense } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatDateKey, formatTime } from '@agendly/shared';
import PublicBookingPage from './[slug].vue';

type BookingState = ReturnType<typeof createBookingState>;
type TenantInfo = {
  name: string;
  slug: string;
  timezone: string;
  logoUrl: string | null;
  bannerUrl: string | null;
  address: string | null;
  phone: string | null;
  latitude: number | null;
  longitude: number | null;
};
type Confirmation = { id: string; startTime: string; endTime: string };

let booking: BookingState;
let wrappers: ReturnType<typeof mount>[] = [];
let originalScrollIntoView: PropertyDescriptor | undefined;
let confirmationProps: Record<string, unknown> | undefined;

function createBookingState(
  options: {
    step?: number;
    date?: string;
    slot?: string;
    tenantInfo?: TenantInfo;
    confirmation?: Confirmation;
  } = {},
) {
  const step = ref(options.step ?? 3);
  const selectedDate = ref(options.date ?? '');
  const selectedSlot = ref(options.slot ?? '');
  const tenantInfo = options.tenantInfo ?? {
    name: 'Estudio Luna',
    slug: 'estudio-luna',
    timezone: 'America/Mexico_City',
    logoUrl: null,
    bannerUrl: null,
    address: null,
    phone: null,
    latitude: null,
    longitude: null,
  };

  return {
    confirmation: ref(options.confirmation ?? null),
    fetchError: ref(null),
    serverWaking: ref(false),
    retryingTenant: ref(false),
    retryTenant: vi.fn(),
    tenantData: ref({ tenant: tenantInfo }),
    tenantName: ref(tenantInfo.name),
    tenantLogoUrl: ref(tenantInfo.logoUrl),
    tenantBannerUrl: ref(tenantInfo.bannerUrl),
    tenantAddress: ref(tenantInfo.address),
    tenantPhone: ref(tenantInfo.phone),
    tenantTimezone: ref(tenantInfo.timezone),
    step,
    services: ref([]),
    selectedService: ref({ name: 'Manicure', durationMinutes: 45, priceMXN: '500' }),
    selectedServiceId: ref('service-1'),
    selectedEmployeeName: ref('Ana López'),
    selectedEmployeeId: ref('employee-1'),
    selectedDate,
    selectedSlot,
    filteredEmployees: ref([]),
    slots: ref([]),
    loadingSlots: ref(false),
    error: ref(''),
    clientForm: reactive({ name: '', phone: '', email: '', privacyAccepted: false }),
    submitting: ref(false),
    selectService: vi.fn(),
    selectEmployee: vi.fn(),
    goToClientForm: vi.fn(() => {
      step.value = 4;
    }),
    submitBooking: vi.fn(),
  };
}

function findStickyContinueButton(wrapper: ReturnType<typeof mount>) {
  return wrapper.findAll('button').find((button) => button.text().trim() === 'Continuar');
}

const confirmationCapture = defineComponent({
  props: ['booking', 'serviceName', 'employeeName', 'tenantName', 'timezone', 'tenantInfo'],
  setup(props) {
    confirmationProps = props as unknown as Record<string, unknown>;
    return () => h('div');
  },
});

async function mountPage() {
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
        BookingConfirmationScreen: confirmationCapture,
        BookingProgressBar: true,
        BookingServiceCard: true,
        BookingEmployeeSelector: true,
        BookingDayTabs: true,
        BookingSlotGrid: true,
        NuxtLink: true,
      },
    },
  });
  wrappers.push(wrapper);
  await flushPromises();
  await nextTick();
  return wrapper;
}

beforeEach(() => {
  wrappers = [];
  confirmationProps = undefined;
  booking = createBookingState();
  originalScrollIntoView = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollIntoView');

  vi.stubGlobal('computed', computed);
  vi.stubGlobal('onMounted', onMounted);
  vi.stubGlobal('definePageMeta', vi.fn());
  vi.stubGlobal('useRoute', () => ({ params: { slug: 'estudio-luna' } }));
  vi.stubGlobal('useSeoMeta', vi.fn());
  vi.stubGlobal('usePublicBooking', async () => booking);
  vi.stubGlobal('getInitials', (name: string) => name.slice(0, 1));
});

afterEach(() => {
  wrappers.forEach((wrapper) => wrapper.unmount());
  if (originalScrollIntoView) {
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', originalScrollIntoView);
  } else {
    Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView');
  }
  vi.unstubAllGlobals();
});

describe('public booking date-and-time continuation', () => {
  it.each([
    ['without a selected day', '', '2026-06-12T17:00:00.000Z'],
    ['without a selected time', '2026-06-12', ''],
  ])('does not show the sticky continuation bar %s', async (_condition, date, slot) => {
    booking = createBookingState({ date, slot });
    const wrapper = await mountPage();

    expect(findStickyContinueButton(wrapper)).toBeUndefined();
  });

  it('shows the sticky summary only for a selected day and time, then hides it when cleared', async () => {
    booking = createBookingState({ date: '2026-06-12', slot: '2026-06-12T17:00:00.000Z' });
    const wrapper = await mountPage();
    const stickyButton = findStickyContinueButton(wrapper);

    expect(stickyButton).toBeDefined();
    expect(stickyButton?.text()).toBe('Continuar');
    const stickyBar = wrapper.findAll('[class]').find((element) => {
      const classes = element.attributes('class') ?? '';
      return /\b(fixed|sticky)\b/.test(classes) && /\bbottom-0\b/.test(classes);
    });
    expect(stickyBar).toBeDefined();
    expect(`${stickyBar?.attributes('class')} ${stickyBar?.attributes('style')}`).toContain(
      'safe-area-inset-bottom',
    );
    expect(wrapper.text()).toContain(
      `${formatDateKey(booking.selectedDate.value, 'short')} · ${formatTime(
        booking.selectedSlot.value,
        'America/Mexico_City',
      )}`,
    );

    booking.selectedSlot.value = '';
    await nextTick();

    expect(findStickyContinueButton(wrapper)).toBeUndefined();
  });

  it('uses the existing continue action and removes the bar after advancing to client details', async () => {
    booking = createBookingState({ date: '2026-06-12', slot: '2026-06-12T17:00:00.000Z' });
    const wrapper = await mountPage();
    const stickyButton = findStickyContinueButton(wrapper);

    expect(stickyButton).toBeDefined();
    await stickyButton?.trigger('click');
    await nextTick();

    expect(booking.goToClientForm).toHaveBeenCalledTimes(1);
    expect(booking.step.value).toBe(4);
    expect(findStickyContinueButton(wrapper)).toBeUndefined();
  });

  it.each([
    ['with motion enabled', false, 'smooth'],
    ['with reduced motion enabled', true, 'not-smooth'],
  ])('focuses and scrolls to the first client field %s', async (_mode, reducedMotion, behavior) => {
    booking = createBookingState({ date: '2026-06-12', slot: '2026-06-12T17:00:00.000Z' });
    const scrollIntoView = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    });
    vi.stubGlobal(
      'matchMedia',
      vi.fn((media: string) => ({
        matches: reducedMotion && media === '(prefers-reduced-motion: reduce)',
        media,
      })),
    );
    const wrapper = await mountPage();
    const stickyButton = findStickyContinueButton(wrapper);

    expect(stickyButton).toBeDefined();
    await stickyButton?.trigger('click');
    await flushPromises();

    const firstField = wrapper.get('#client-name').element;
    expect(document.activeElement).toBe(firstField);
    expect(scrollIntoView).toHaveBeenCalled();
    const scrollOptions = scrollIntoView.mock.calls.at(-1)?.[0] as
      | ScrollIntoViewOptions
      | undefined;
    if (behavior === 'smooth') {
      expect(scrollOptions?.behavior).toBe('smooth');
    } else {
      expect(scrollOptions?.behavior).not.toBe('smooth');
    }
  });
});

describe('public booking confirmation handoff', () => {
  it('passes the public business information through to the confirmation screen', async () => {
    const tenantInfo: TenantInfo = {
      name: 'Estudio Luna',
      slug: 'estudio-luna',
      timezone: 'America/Mexico_City',
      logoUrl: 'https://cdn.example.test/luna-logo.webp',
      bannerUrl: 'https://cdn.example.test/luna-banner.webp',
      address: 'Av. Vallarta 123, Guadalajara',
      phone: '+52 33 1234 5678',
      latitude: 20.6736,
      longitude: -103.344,
    };
    booking = createBookingState({
      tenantInfo,
      confirmation: {
        id: 'appointment-123456',
        startTime: '2026-06-12T17:00:00.000Z',
        endTime: '2026-06-12T17:45:00.000Z',
      },
    });

    await mountPage();

    expect(confirmationProps?.tenantInfo).toEqual(tenantInfo);
  });
});
