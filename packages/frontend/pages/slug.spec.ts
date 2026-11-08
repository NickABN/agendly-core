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

type IntersectionObserverStub = {
  instances: FakeIntersectionObserver[];
  emit: (isIntersecting: boolean) => void;
};

class FakeIntersectionObserver {
  static registry: FakeIntersectionObserver[] = [];
  callback: IntersectionObserverCallback;
  observed: Element[] = [];
  disconnected = false;

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
    FakeIntersectionObserver.registry.push(this);
  }

  observe(target: Element) {
    this.observed.push(target);
  }

  unobserve(target: Element) {
    this.observed = this.observed.filter((element) => element !== target);
  }

  disconnect() {
    this.disconnected = true;
    this.observed = [];
  }

  takeRecords() {
    return [] as IntersectionObserverEntry[];
  }
}

function installIntersectionObserver(): IntersectionObserverStub {
  FakeIntersectionObserver.registry = [];
  vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
  return {
    instances: FakeIntersectionObserver.registry,
    emit(isIntersecting: boolean) {
      const active = FakeIntersectionObserver.registry.filter((observer) => !observer.disconnected);
      const observer = active[active.length - 1];
      if (!observer) throw new Error('No active IntersectionObserver to emit from');
      observer.callback(
        [{ isIntersecting } as IntersectionObserverEntry],
        observer as unknown as IntersectionObserver,
      );
    },
  };
}

describe('public booking sticky bar vs in-page continue button (S1)', () => {
  it('hides the sticky bar while the in-page continue button intersects the viewport', async () => {
    const observer = installIntersectionObserver();
    booking = createBookingState({ date: '2026-06-12', slot: '2026-06-12T17:00:00.000Z' });
    const wrapper = await mountPage();

    // Initially (button in view) the sticky bar must not be shown.
    observer.emit(true);
    await nextTick();

    expect(findStickyContinueButton(wrapper)).toBeUndefined();
  });

  it('shows the sticky bar when the in-page continue button leaves the viewport', async () => {
    const observer = installIntersectionObserver();
    booking = createBookingState({ date: '2026-06-12', slot: '2026-06-12T17:00:00.000Z' });
    const wrapper = await mountPage();

    observer.emit(true);
    await nextTick();
    expect(findStickyContinueButton(wrapper)).toBeUndefined();

    observer.emit(false);
    await nextTick();
    expect(findStickyContinueButton(wrapper)).toBeDefined();
  });

  it('keeps the sticky bar hidden without a day and time even when out of view', async () => {
    const observer = installIntersectionObserver();
    booking = createBookingState({ date: '', slot: '' });
    const wrapper = await mountPage();

    if (observer.instances.some((instance) => !instance.disconnected)) {
      observer.emit(false);
    }
    await nextTick();

    expect(findStickyContinueButton(wrapper)).toBeUndefined();
  });

  it('does not crash and keeps the bar visible when IntersectionObserver is unavailable', async () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    booking = createBookingState({ date: '2026-06-12', slot: '2026-06-12T17:00:00.000Z' });
    const wrapper = await mountPage();

    // Fallback behavior: bar stays visible while day + time are selected.
    expect(findStickyContinueButton(wrapper)).toBeDefined();
  });

  it('disconnects the observer when leaving the date-and-time step', async () => {
    const observer = installIntersectionObserver();
    booking = createBookingState({ date: '2026-06-12', slot: '2026-06-12T17:00:00.000Z' });
    await mountPage();

    const activeBefore = observer.instances.filter((instance) => !instance.disconnected);
    expect(activeBefore.length).toBeGreaterThan(0);

    booking.step.value = 4;
    await nextTick();

    expect(observer.instances.every((instance) => instance.disconnected)).toBe(true);
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
