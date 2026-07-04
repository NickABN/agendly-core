import { describe, it, expect, vi, beforeEach } from 'vitest';
import type {
  ProfileDto,
  UploadResponseDto,
  ImageVersionDto,
} from '@agendly/shared';

// --- Nuxt / store stubs ---

const mockToken = 'test-token';

vi.mock('~/stores/auth', () => ({
  useAuthStore: () => ({ token: mockToken }),
}));

vi.stubGlobal('useRuntimeConfig', () => ({
  public: { apiUrl: 'http://localhost:3000' },
}));

const mockFetch = vi.fn();
vi.stubGlobal('$fetch', mockFetch);

// Import AFTER stubs are in place
const { useProfileApi } = await import('./useProfileApi');

// --- Fixtures ---

const profileFixture: ProfileDto = {
  id: 'tenant-1',
  name: 'Salón Ejemplo',
  slug: 'salon-ejemplo',
  phone: '+521234567890',
  address: 'Calle Falsa 123',
  logoUrl: 'https://r2.example.com/logo.png',
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

describe('useProfileApi', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe('getProfile', () => {
    it('returns a typed ProfileDto', async () => {
      mockFetch.mockResolvedValueOnce(profileFixture);

      const { getProfile } = useProfileApi();
      const result = await getProfile();

      // Verify the call
      expect(mockFetch).toHaveBeenCalledOnce();
      expect(mockFetch).toHaveBeenCalledWith('http://localhost:3000/profile', {
        headers: { Authorization: `Bearer ${mockToken}` },
      });

      // Verify the shape matches ProfileDto
      expect(result).toEqual(profileFixture);
      expect(typeof result.id).toBe('string');
      expect(typeof result.name).toBe('string');
      expect(typeof result.timezone).toBe('string');
      // Optional fields may be null
      expect(result.bannerUrl).toBeNull();
    });
  });

  describe('uploadImage', () => {
    it('sends multipart/form-data with the correct "file" field for logo', async () => {
      mockFetch.mockResolvedValueOnce(uploadResponseFixture);

      const { uploadImage } = useProfileApi();
      const file = new File(['content'], 'logo.png', { type: 'image/png' });

      const result = await uploadImage('logo', file);

      expect(mockFetch).toHaveBeenCalledOnce();

      const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit & { body: FormData }];

      expect(url).toBe('http://localhost:3000/profile/logo');
      expect(options.method).toBe('POST');
      expect(options.headers).toEqual({ Authorization: `Bearer ${mockToken}` });

      // Verify FormData contains the 'file' field
      expect(options.body).toBeInstanceOf(FormData);
      expect((options.body as FormData).get('file')).toBe(file);

      expect(result).toEqual(uploadResponseFixture);
    });

    it('sends multipart/form-data with the correct "file" field for banner', async () => {
      mockFetch.mockResolvedValueOnce(uploadResponseFixture);

      const { uploadImage } = useProfileApi();
      const file = new File(['content'], 'banner.jpg', { type: 'image/jpeg' });

      await uploadImage('banner', file);

      const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit & { body: FormData }];

      expect(url).toBe('http://localhost:3000/profile/banner');
      expect((options.body as FormData).get('file')).toBe(file);
    });
  });
});
