import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTenantConfig } from './useTenantConfig';

describe('useTenantConfig public directory preference', () => {
  let api: { get: ReturnType<typeof vi.fn>; patch: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    api = {
      get: vi.fn().mockResolvedValue({
        id: 'tenant-1',
        name: 'Salón Calma',
        slug: 'salon-calma',
        phone: null,
        address: null,
        logoUrl: null,
        latitude: null,
        longitude: null,
        timezone: 'America/Mexico_City',
        listedInDirectory: true,
      }),
      patch: vi.fn().mockResolvedValue(undefined),
    };
    vi.stubGlobal('useApi', () => api);
    vi.stubGlobal('useRuntimeConfig', () => ({ public: { apiUrl: '' } }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads the tenant opt-in value into the settings form', async () => {
    const tenantConfig = useTenantConfig();

    await tenantConfig.load();

    const form = tenantConfig.form as typeof tenantConfig.form & {
      listedInDirectory?: boolean;
    };
    expect(form.listedInDirectory).toBe(true);
  });

  it('sends false as well as true when saving the tenant directory preference', async () => {
    const tenantConfig = useTenantConfig();
    const form = tenantConfig.form as typeof tenantConfig.form & {
      listedInDirectory?: boolean;
    };
    form.slug = 'salon-calma';
    form.listedInDirectory = false;

    await tenantConfig.save();

    expect(api.patch).toHaveBeenCalledWith('/tenant', {
      slug: 'salon-calma',
      listedInDirectory: false,
    });
  });
});
