import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import type { ProfileDto, UploadResponseDto, ImageVersionDto } from '@agendly/shared';

// --- Nuxt / store stubs ---

vi.mock('~/stores/auth', () => ({
  useAuthStore: () => ({ token: 'test-token' }),
}));

vi.stubGlobal('useRuntimeConfig', () => ({
  public: { apiUrl: 'http://localhost:3000' },
}));

vi.stubGlobal('$fetch', vi.fn());

// Mock useProfileApi
const mockGetProfile = vi.fn();
const mockUpdateProfile = vi.fn();
const mockUpdateLocation = vi.fn();
const mockUploadImage = vi.fn();
const mockGetImageHistory = vi.fn();

vi.mock('~/composables/useProfileApi', () => ({
  useProfileApi: () => ({
    getProfile: mockGetProfile,
    updateProfile: mockUpdateProfile,
    updateLocation: mockUpdateLocation,
    uploadImage: mockUploadImage,
    getImageHistory: mockGetImageHistory,
  }),
}));

// Import AFTER mocks are in place
const { useProfileStore } = await import('./profile');

// --- Fixtures ---

const profileFixture: ProfileDto = {
  id: 'tenant-1',
  name: 'Salón Ejemplo',
  slug: 'salon-ejemplo',
  phone: '+521234567890',
  address: 'Calle Falsa 123',
  logoUrl: null,
  bannerUrl: null,
  latitude: 19.4326,
  longitude: -99.1332,
  timezone: 'America/Mexico_City',
  onboardedAt: '2024-01-01T00:00:00.000Z',
  trialEndsAt: '2024-04-01T00:00:00.000Z',
  isActive: true,
};

const imageVersionFixture: ImageVersionDto = {
  id: 'iv-1',
  tenantId: 'tenant-1',
  url: 'https://r2.example.com/logo.png',
  fileSize: 102400,
  imageType: 'LOGO',
  createdAt: '2024-01-01T00:00:00.000Z',
};

const uploadResponseFixture: UploadResponseDto = {
  url: 'https://r2.example.com/logo.png',
  imageVersion: imageVersionFixture,
};

// --- Tests ---

describe('useProfileStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  describe('uploadLogo', () => {
    it('calls uploadImage with "logo" and updates profileData.logoUrl', async () => {
      mockUploadImage.mockResolvedValueOnce(uploadResponseFixture);

      const store = useProfileStore();
      // Set initial profileData so the URL update can be applied
      store.profileData = { ...profileFixture, logoUrl: null };

      const file = new File(['content'], 'logo.png', { type: 'image/png' });
      await store.uploadLogo(file);

      // Verifies the correct endpoint type was called
      expect(mockUploadImage).toHaveBeenCalledOnce();
      expect(mockUploadImage).toHaveBeenCalledWith('logo', file);

      // Verifies profileData.logoUrl was updated
      expect(store.profileData?.logoUrl).toBe('https://r2.example.com/logo.png');
      expect(store.error).toBeNull();
      expect(store.loading).toBe(false);
    });

    it('sets error when uploadImage fails', async () => {
      mockUploadImage.mockRejectedValueOnce(new Error('Upload failed'));

      const store = useProfileStore();
      store.profileData = { ...profileFixture };

      const file = new File(['content'], 'logo.png', { type: 'image/png' });
      await store.uploadLogo(file);

      expect(store.error).toBe('Upload failed');
      expect(store.loading).toBe(false);
    });
  });

  describe('saveProfile', () => {
    it('updates profileData on success', async () => {
      const updatedProfile = { ...profileFixture, name: 'Nuevo Nombre' };
      mockUpdateProfile.mockResolvedValueOnce(updatedProfile);

      const store = useProfileStore();
      await store.saveProfile({ name: 'Nuevo Nombre' });

      expect(mockUpdateProfile).toHaveBeenCalledWith({ name: 'Nuevo Nombre' });
      expect(store.profileData?.name).toBe('Nuevo Nombre');
      expect(store.error).toBeNull();
    });

    it('sets error in store when a validation error occurs', async () => {
      // Simulates a 422 validation error from the API
      const validationError = new Error('El nombre debe tener entre 2 y 100 caracteres');
      mockUpdateProfile.mockRejectedValueOnce(validationError);

      const store = useProfileStore();
      await store.saveProfile({ name: 'X' });

      expect(store.error).toBe('El nombre debe tener entre 2 y 100 caracteres');
      expect(store.profileData).toBeNull();
      expect(store.loading).toBe(false);
    });

    it('sets a generic error message for non-Error rejections', async () => {
      mockUpdateProfile.mockRejectedValueOnce('unexpected string error');

      const store = useProfileStore();
      await store.saveProfile({ name: 'Test' });

      expect(store.error).toBe('Error al guardar el perfil');
    });
  });
});
