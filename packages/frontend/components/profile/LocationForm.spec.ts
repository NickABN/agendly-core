// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import LocationForm from './LocationForm.vue';

const leafletMock = vi.hoisted(() => {
  let mapClickHandler: ((event: { latlng: { lat: number; lng: number } }) => unknown) | undefined;
  let markerDragHandler: (() => unknown) | undefined;
  let markerPosition = { lat: 19.4326, lng: -99.1332 };

  const markerInstance = {
    addTo: vi.fn(() => markerInstance),
    on: vi.fn((event: string, handler: () => unknown) => {
      if (event === 'dragend') markerDragHandler = handler;
      return markerInstance;
    }),
    getLatLng: vi.fn(() => markerPosition),
    setLatLng: vi.fn((value: [number, number] | { lat: number; lng: number }) => {
      markerPosition = Array.isArray(value) ? { lat: value[0], lng: value[1] } : value;
      return markerInstance;
    }),
  };

  const mapInstance = {
    setView: vi.fn(() => mapInstance),
    invalidateSize: vi.fn(),
    getZoom: vi.fn(() => 13),
    remove: vi.fn(),
    on: vi.fn(
      (event: string, handler: (event: { latlng: { lat: number; lng: number } }) => unknown) => {
        if (event === 'click') mapClickHandler = handler;
        return mapInstance;
      },
    ),
  };

  const api = {
    Icon: { Default: { prototype: {}, mergeOptions: vi.fn() } },
    map: vi.fn(() => mapInstance),
    tileLayer: vi.fn(() => ({ addTo: vi.fn() })),
    marker: vi.fn((position: [number, number]) => {
      markerPosition = { lat: position[0], lng: position[1] };
      return markerInstance;
    }),
    mapInstance,
    markerInstance,
    triggerMapClick: (lat: number, lng: number) => mapClickHandler?.({ latlng: { lat, lng } }),
    triggerMarkerDrag: (lat: number, lng: number) => {
      markerPosition = { lat, lng };
      return markerDragHandler?.();
    },
    reset: () => {
      mapClickHandler = undefined;
      markerDragHandler = undefined;
      markerPosition = { lat: 19.4326, lng: -99.1332 };
      vi.clearAllMocks();
    },
  };

  return api;
});

vi.mock('leaflet', () => leafletMock);
vi.mock('leaflet/dist/leaflet.css', () => ({}));

// Controllable ResizeObserver harness: lets a test trigger the resize callback
// and assert that the observer is disconnected on unmount.
const resizeObserverHarness = vi.hoisted(() => {
  const instances: {
    callback: ResizeObserverCallback;
    observe: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
  }[] = [];

  class MockResizeObserver {
    callback: ResizeObserverCallback;
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();

    constructor(callback: ResizeObserverCallback) {
      this.callback = callback;
      instances.push({ callback, observe: this.observe, disconnect: this.disconnect });
    }
  }

  return {
    MockResizeObserver,
    instances,
    latest: () => instances[instances.length - 1],
    triggerResize: () => {
      const latest = instances[instances.length - 1];
      latest?.callback([] as unknown as ResizeObserverEntry[], latest as unknown as ResizeObserver);
    },
    reset: () => {
      instances.splice(0);
    },
  };
});

const originalResizeObserver = Object.getOwnPropertyDescriptor(globalThis, 'ResizeObserver');

const mockFetch = vi.fn();
const noResultMessage = 'No encontramos esa dirección, intenta con calle, número y colonia';
const geoErrorMessage = 'No pudimos obtener tu ubicación';
const wrappers: VueWrapper[] = [];
const originalGeolocation = Object.getOwnPropertyDescriptor(navigator, 'geolocation');

function installVueGlobals() {
  vi.stubGlobal('ref', ref);
  vi.stubGlobal('computed', computed);
  vi.stubGlobal('reactive', reactive);
  vi.stubGlobal('watch', watch);
  vi.stubGlobal('onMounted', onMounted);
  vi.stubGlobal('onUnmounted', onUnmounted);
}

async function mountLocationForm(
  initialData: { address: string | null; latitude: number | null; longitude: number | null } = {
    address: null,
    latitude: null,
    longitude: null,
  },
) {
  setActivePinia(createPinia());
  const wrapper = mount(LocationForm, { props: { initialData } });
  wrappers.push(wrapper);
  await flushPromises();
  return wrapper;
}

function findButton(wrapper: VueWrapper, label: RegExp) {
  return wrapper.findAll('button').find((button) => label.test(button.text()));
}

function callsFor(path: string, method: string) {
  return mockFetch.mock.calls.filter(([url, options]) => {
    const requestMethod = (options as RequestInit | undefined)?.method ?? 'GET';
    return String(url).includes(path) && requestMethod === method;
  });
}

beforeEach(() => {
  installVueGlobals();
  vi.stubGlobal('definePageMeta', vi.fn());
  vi.stubGlobal('apiBase', () => 'http://localhost:3000');
  vi.stubGlobal('$fetch', mockFetch);
  mockFetch.mockReset();
  leafletMock.reset();
  resizeObserverHarness.reset();
  Object.defineProperty(globalThis, 'ResizeObserver', {
    configurable: true,
    writable: true,
    value: resizeObserverHarness.MockResizeObserver,
  });
});

afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount());
  if (originalGeolocation) {
    Object.defineProperty(navigator, 'geolocation', originalGeolocation);
  } else {
    Reflect.deleteProperty(navigator, 'geolocation');
  }
  if (originalResizeObserver) {
    Object.defineProperty(globalThis, 'ResizeObserver', originalResizeObserver);
  } else {
    Reflect.deleteProperty(globalThis, 'ResizeObserver');
  }
  vi.unstubAllGlobals();
});

describe('profile location form UX', () => {
  it('does not save or geocode an address on blur', async () => {
    mockFetch.mockResolvedValue({
      address: 'Calle 5',
      latitude: 19.4,
      longitude: -99.1,
    });
    const wrapper = await mountLocationForm();

    await wrapper.get('#location-address').setValue('Calle 5, Colonia Centro');
    await wrapper.get('#location-address').trigger('blur');
    await flushPromises();

    expect(callsFor('/profile/location', 'PATCH')).toHaveLength(0);
    expect(callsFor('/profile/geocode', 'GET')).toHaveLength(0);
  });

  it('searches by button, moves the pin, and does not save', async () => {
    const coordinates = { latitude: 19.4012, longitude: -99.1517 };
    mockFetch.mockResolvedValue(coordinates);
    const wrapper = await mountLocationForm();
    const address = 'Calle 5, número 20, Colonia Centro';
    const addressInput = wrapper.get('#location-address');

    expect(findButton(wrapper, /^buscar$/i)).toBeDefined();
    await addressInput.setValue(address);
    await findButton(wrapper, /^buscar$/i)!.trigger('click');
    await flushPromises();

    const firstSearch = callsFor('/profile/geocode', 'GET')[0];
    expect(firstSearch).toBeDefined();
    expect(new URL(String(firstSearch[0])).searchParams.get('q')).toBe(address);
    expect(leafletMock.marker).toHaveBeenCalledWith(
      [coordinates.latitude, coordinates.longitude],
      expect.objectContaining({ draggable: true }),
    );
    expect(callsFor('/profile/location', 'PATCH')).toHaveLength(0);
  });

  it('starts address search when Enter is pressed', async () => {
    mockFetch.mockResolvedValueOnce({ latitude: 19.4012, longitude: -99.1517 });
    const wrapper = await mountLocationForm();
    const address = 'Calle 5, Colonia Centro';

    await wrapper.get('#location-address').setValue(address);
    await wrapper.get('#location-address').trigger('keydown', { key: 'Enter' });
    await flushPromises();

    const search = callsFor('/profile/geocode', 'GET')[0];
    expect(search).toBeDefined();
    expect(new URL(String(search?.[0])).searchParams.get('q')).toBe(address);
    expect(callsFor('/profile/location', 'PATCH')).toHaveLength(0);
  });

  it('shows the specified message when address search has no result', async () => {
    mockFetch.mockResolvedValueOnce(null);
    const wrapper = await mountLocationForm();

    await wrapper.get('#location-address').setValue('Dirección inexistente 999');
    const searchButton = findButton(wrapper, /^buscar$/i);
    expect(searchButton).toBeDefined();
    await searchButton!.trigger('click');
    await flushPromises();

    expect(wrapper.text()).toContain(noResultMessage);
    expect(callsFor('/profile/location', 'PATCH')).toHaveLength(0);
  });

  it('shows a retry message, not "not found", when the search request fails', async () => {
    mockFetch.mockRejectedValueOnce(new Error('network down'));
    const wrapper = await mountLocationForm();

    await wrapper.get('#location-address').setValue('Av. Reforma 222');
    await findButton(wrapper, /^buscar$/i)!.trigger('click');
    await flushPromises();

    expect(wrapper.text()).toContain(
      'No pudimos buscar la dirección. Intenta de nuevo en un momento.',
    );
    expect(wrapper.text()).not.toContain(noResultMessage);
  });

  it('moves the pin to browser coordinates when geolocation succeeds', async () => {
    const getCurrentPosition = vi.fn((success: PositionCallback) => {
      success({
        coords: {
          latitude: 19.365,
          longitude: -99.18,
          accuracy: 10,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
        },
        timestamp: Date.now(),
      } as GeolocationPosition);
    });
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: { getCurrentPosition },
    });
    const wrapper = await mountLocationForm();

    const locationButton = findButton(wrapper, /usar mi ubicación actual/i);
    expect(locationButton).toBeDefined();
    await locationButton!.trigger('click');
    await flushPromises();

    expect(getCurrentPosition).toHaveBeenCalledOnce();
    expect(leafletMock.marker).toHaveBeenCalledWith(
      [19.365, -99.18],
      expect.objectContaining({ draggable: true }),
    );
    expect(callsFor('/profile/location', 'PATCH')).toHaveLength(0);
  });

  it('shows a clear message when browser geolocation is denied', async () => {
    const getCurrentPosition = vi.fn((_success: PositionCallback, error: PositionErrorCallback) => {
      error({
        code: 1,
        message: 'Permission denied',
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3,
      });
    });
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: { getCurrentPosition },
    });
    const wrapper = await mountLocationForm();

    const locationButton = findButton(wrapper, /usar mi ubicación actual/i);
    expect(locationButton).toBeDefined();
    await locationButton!.trigger('click');
    await flushPromises();

    expect(wrapper.text()).toContain(geoErrorMessage);
    expect(callsFor('/profile/location', 'PATCH')).toHaveLength(0);
  });

  it('moves the marker on map click and keeps it draggable', async () => {
    const wrapper = await mountLocationForm();

    expect(leafletMock.map).toHaveBeenCalledOnce();
    await leafletMock.triggerMapClick(20.1234, -100.5678);
    await flushPromises();

    expect(leafletMock.marker).toHaveBeenCalledWith(
      [20.1234, -100.5678],
      expect.objectContaining({ draggable: true }),
    );
    expect(wrapper.text()).toContain('20.123400');
    expect(wrapper.text()).toContain('-100.567800');

    await leafletMock.triggerMarkerDrag(20.2, -100.6);
    await flushPromises();
    expect(wrapper.text()).toContain('20.200000');
    expect(wrapper.text()).toContain('-100.600000');
  });

  it('shows the location helper text above the map', async () => {
    const wrapper = await mountLocationForm();

    expect(wrapper.text()).toContain('Busca tu dirección o arrastra el pin hasta tu local.');

    const mapHeading = wrapper.text().indexOf('Ubicación en el mapa');
    const helperText = wrapper
      .text()
      .indexOf('Busca tu dirección o arrastra el pin hasta tu local.');
    expect(helperText).toBeLessThan(mapHeading);
  });

  it('geocodes a retyped address on save instead of keeping the old pin', async () => {
    mockFetch.mockResolvedValueOnce({ latitude: 20.6597, longitude: -103.3496 });
    const wrapper = await mountLocationForm();

    await wrapper.get('#location-address').setValue('Av. Chapultepec 15, Guadalajara');
    await wrapper.get('form').trigger('submit');
    await flushPromises();

    expect(wrapper.emitted('submit')?.[0]?.[0]).toEqual({
      address: 'Av. Chapultepec 15, Guadalajara',
      latitude: 20.6597,
      longitude: -103.3496,
    });
  });

  it('keeps a manually dragged pin for a typed address instead of re-geocoding it', async () => {
    const wrapper = await mountLocationForm({
      address: 'Calle 1',
      latitude: 19.4326,
      longitude: -99.1332,
    });

    await wrapper.get('#location-address').setValue('Calle 2, Centro');
    await leafletMock.triggerMarkerDrag(19.5, -99.2);
    await wrapper.get('form').trigger('submit');
    await flushPromises();

    expect(callsFor('/profile/geocode', 'GET')).toHaveLength(0);
    expect(wrapper.emitted('submit')?.[0]?.[0]).toEqual({
      address: 'Calle 2, Centro',
      latitude: 19.5,
      longitude: -99.2,
    });
  });

  it('does not save a retyped address that cannot be located', async () => {
    mockFetch.mockResolvedValueOnce(null);
    const wrapper = await mountLocationForm();

    await wrapper.get('#location-address').setValue('Dirección inexistente 999');
    await wrapper.get('form').trigger('submit');
    await flushPromises();

    expect(wrapper.emitted('submit')).toBeUndefined();
    expect(wrapper.text()).toContain(noResultMessage);
  });

  it('submits the address and both pin coordinates together with one save action', async () => {
    const wrapper = await mountLocationForm();
    const address = 'Av. Insurgentes 123, Colonia Del Valle';

    await wrapper.get('#location-address').setValue(address);
    await leafletMock.triggerMapClick(19.387, -99.167);
    await flushPromises();

    const saveButton = wrapper.find('button[type="submit"]');
    expect(saveButton.exists()).toBe(true);
    expect(saveButton.attributes('type')).toBe('submit');
    await saveButton.trigger('click');
    // jsdom does not perform native form submission as the default action of a button click.
    await wrapper.get('form').trigger('submit');

    expect(wrapper.emitted('submit')?.[0]?.[0]).toEqual({
      address,
      latitude: 19.387,
      longitude: -99.167,
    });
  });
});

describe('profile location form map resize handling', () => {
  it('invalidates the map size when the container is resized', async () => {
    await mountLocationForm();

    expect(resizeObserverHarness.latest()).toBeDefined();
    const invalidateCallsBefore = leafletMock.mapInstance.invalidateSize.mock.calls.length;

    resizeObserverHarness.triggerResize();
    await flushPromises();

    expect(leafletMock.mapInstance.invalidateSize.mock.calls.length).toBeGreaterThan(
      invalidateCallsBefore,
    );
  });

  it('recenters an existing pin after a resize using the current zoom', async () => {
    const wrapper = await mountLocationForm({
      address: 'Calle 1',
      latitude: 19.4326,
      longitude: -99.1332,
    });
    await flushPromises();

    leafletMock.mapInstance.setView.mockClear();
    resizeObserverHarness.triggerResize();
    await flushPromises();

    expect(leafletMock.mapInstance.setView).toHaveBeenCalledWith(
      { lat: 19.4326, lng: -99.1332 },
      13,
    );
    wrapper.unmount();
  });

  it('disconnects the resize observer on unmount', async () => {
    const wrapper = await mountLocationForm();
    const observer = resizeObserverHarness.latest();
    expect(observer).toBeDefined();

    wrapper.unmount();

    expect(observer!.disconnect).toHaveBeenCalled();
  });

  it('does not crash when ResizeObserver is undefined', async () => {
    Reflect.deleteProperty(globalThis, 'ResizeObserver');

    await expect(mountLocationForm()).resolves.toBeDefined();
    expect(leafletMock.map).toHaveBeenCalled();
  });
});
