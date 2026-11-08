// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { computed, onUnmounted, ref } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ImageUpload from './ImageUpload.vue';

const mockFetch = vi.fn();
const serverMessage = 'La carga de imágenes no está disponible por ahora';
let wrapper: VueWrapper | undefined;
const originalCreateObjectURL = Object.getOwnPropertyDescriptor(URL, 'createObjectURL');

beforeEach(() => {
  setActivePinia(createPinia());
  vi.stubGlobal('ref', ref);
  vi.stubGlobal('computed', computed);
  vi.stubGlobal('onUnmounted', onUnmounted);
  vi.stubGlobal('apiBase', () => 'http://localhost:3000');
  vi.stubGlobal('$fetch', mockFetch);
  mockFetch.mockReset();
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: vi.fn(() => 'blob:upload-preview'),
  });
});

afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  if (originalCreateObjectURL) {
    Object.defineProperty(URL, 'createObjectURL', originalCreateObjectURL);
  } else {
    Reflect.deleteProperty(URL, 'createObjectURL');
  }
  vi.unstubAllGlobals();
});

describe('profile image upload storage-unavailable response', () => {
  it('shows the backend 503 message inline beside the uploader', async () => {
    const serverError = Object.assign(new Error('Request failed with status code 503'), {
      status: 503,
      statusCode: 503,
      data: { statusCode: 503, message: serverMessage },
    });
    mockFetch.mockRejectedValueOnce(serverError);

    wrapper = mount(ImageUpload, {
      props: { type: 'logo', currentUrl: null, maxSizeMb: 5 },
    });

    const fileInput = wrapper.get('input[type="file"]');
    Object.defineProperty(fileInput.element, 'files', {
      configurable: true,
      value: [new File(['image-bytes'], 'logo.png', { type: 'image/png' })],
    });
    await fileInput.trigger('change');
    await flushPromises();

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3000/profile/logo',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(wrapper.get('p.text-red-600').text()).toContain(serverMessage);
  });
});
