// @vitest-environment jsdom
import { mount } from '@vue/test-utils';
import { computed } from 'vue';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ImageVersionDto } from '@agendly/shared';
import ImageHistory from './ImageHistory.vue';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('profile image history', () => {
  it('marks only the version matching the current URL as in use', () => {
    vi.stubGlobal('computed', computed);
    const images: ImageVersionDto[] = [
      {
        id: 'logo-current',
        tenantId: 'tenant-1',
        url: 'https://images.example.com/logo-current.png',
        fileSize: 102400,
        imageType: 'LOGO',
        createdAt: '2024-01-02T12:00:00.000Z',
      },
      {
        id: 'logo-old',
        tenantId: 'tenant-1',
        url: 'https://images.example.com/logo-old.png',
        fileSize: 204800,
        imageType: 'LOGO',
        createdAt: '2024-01-01T12:00:00.000Z',
      },
      {
        id: 'banner-current',
        tenantId: 'tenant-1',
        url: 'https://images.example.com/banner.png',
        fileSize: 409600,
        imageType: 'BANNER',
        createdAt: '2024-01-03T12:00:00.000Z',
      },
    ];

    const wrapper = mount(ImageHistory, {
      props: {
        images,
        type: 'LOGO',
        currentUrl: 'https://images.example.com/logo-current.png',
      },
    });

    const items = wrapper.findAll('li');
    expect(items).toHaveLength(2);
    expect(items[0]!.text()).toContain('En uso');
    expect(items[1]!.text()).not.toContain('En uso');
    wrapper.unmount();
  });
});
