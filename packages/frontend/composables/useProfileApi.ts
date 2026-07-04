import type {
  ProfileDto,
  UpdateProfileDto,
  UpdateLocationDto,
  LocationUpdateResponseDto,
  UploadResponseDto,
  ImageVersionDto,
} from '@agendly/shared';
import { useAuthStore } from '~/stores/auth';

export function useProfileApi() {
  const config = useRuntimeConfig();
  const store = useAuthStore();
  const apiUrl = config.public.apiUrl;

  function authHeaders(): Record<string, string> {
    return store.token ? { Authorization: `Bearer ${store.token}` } : {};
  }

  async function getProfile(): Promise<ProfileDto> {
    return $fetch<ProfileDto>(`${apiUrl}/profile`, {
      headers: authHeaders(),
    });
  }

  async function updateProfile(dto: UpdateProfileDto): Promise<ProfileDto> {
    return $fetch<ProfileDto>(`${apiUrl}/profile`, {
      method: 'PATCH',
      body: dto,
      headers: authHeaders(),
    });
  }

  async function updateLocation(dto: UpdateLocationDto): Promise<LocationUpdateResponseDto> {
    return $fetch<LocationUpdateResponseDto>(`${apiUrl}/profile/location`, {
      method: 'PATCH',
      body: dto,
      headers: authHeaders(),
    });
  }

  async function uploadImage(
    type: 'logo' | 'banner',
    file: File,
  ): Promise<UploadResponseDto> {
    const formData = new FormData();
    formData.append('file', file);

    return $fetch<UploadResponseDto>(`${apiUrl}/profile/${type}`, {
      method: 'POST',
      body: formData,
      headers: authHeaders(),
    });
  }

  async function getImageHistory(): Promise<ImageVersionDto[]> {
    return $fetch<ImageVersionDto[]>(`${apiUrl}/profile/images`, {
      headers: authHeaders(),
    });
  }

  return {
    getProfile,
    updateProfile,
    updateLocation,
    uploadImage,
    getImageHistory,
  };
}
