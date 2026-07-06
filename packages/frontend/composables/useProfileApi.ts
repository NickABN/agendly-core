import type {
  ProfileDto,
  UpdateProfileDto,
  UpdateLocationDto,
  LocationUpdateResponseDto,
  UploadResponseDto,
  ImageVersionDto,
} from '@agendly/shared';

export function useProfileApi() {
  // apiBase(): URL interna del backend en SSR, pública en el cliente.
  const apiUrl = apiBase();
  // Auth por cookie httpOnly: en SSR reenviamos la cookie entrante.
  const ssrHeaders = import.meta.server ? useRequestHeaders(['cookie']) : {};

  async function getProfile(): Promise<ProfileDto> {
    return $fetch<ProfileDto>(`${apiUrl}/profile`, {
      credentials: 'include',
      headers: ssrHeaders,
    });
  }

  async function updateProfile(dto: UpdateProfileDto): Promise<ProfileDto> {
    return $fetch<ProfileDto>(`${apiUrl}/profile`, {
      method: 'PATCH',
      body: dto,
      credentials: 'include',
      headers: ssrHeaders,
    });
  }

  async function updateLocation(dto: UpdateLocationDto): Promise<LocationUpdateResponseDto> {
    return $fetch<LocationUpdateResponseDto>(`${apiUrl}/profile/location`, {
      method: 'PATCH',
      body: dto,
      credentials: 'include',
      headers: ssrHeaders,
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
      credentials: 'include',
      headers: ssrHeaders,
    });
  }

  async function getImageHistory(): Promise<ImageVersionDto[]> {
    return $fetch<ImageVersionDto[]>(`${apiUrl}/profile/images`, {
      credentials: 'include',
      headers: ssrHeaders,
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
