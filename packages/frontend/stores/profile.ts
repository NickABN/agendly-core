import { defineStore } from 'pinia';
import { ref } from 'vue';
import type {
  ProfileDto,
  UpdateProfileDto,
  UpdateLocationDto,
  ImageVersionDto,
} from '@agendly/shared';
import { useProfileApi } from '~/composables/useProfileApi';

const STORAGE_UNAVAILABLE_MESSAGE = 'La carga de imágenes no está disponible por ahora';

function uploadErrorMessage(error: unknown, fallback: string): string {
  const response = error as {
    data?: { message?: unknown };
    response?: { status?: number; _data?: { message?: unknown } };
    status?: number;
    statusCode?: number;
    message?: unknown;
  };
  // Prefer the server's own message; a raw fetch error message (e.g. "[POST] ... 503")
  // must never win over the friendly storage message.
  const serverMessage = response?.data?.message ?? response?.response?._data?.message;
  if (Array.isArray(serverMessage))
    return serverMessage.filter((item) => typeof item === 'string').join(', ');
  if (typeof serverMessage === 'string' && serverMessage.length > 0) return serverMessage;
  if ([response?.status, response?.statusCode, response?.response?.status].includes(503)) {
    return STORAGE_UNAVAILABLE_MESSAGE;
  }
  const message = response?.message;
  if (typeof message === 'string' && message.length > 0) return message;
  return error instanceof Error ? error.message : fallback;
}

export const useProfileStore = defineStore('profile', () => {
  // The API composable is instantiated ONCE at store setup, not per action
  const api = useProfileApi();

  const profileData = ref<ProfileDto | null>(null);
  const imageHistory = ref<ImageVersionDto[]>([]);
  const loading = ref(false);
  const uploadProgress = ref(0);
  const error = ref<string | null>(null);
  const geocodingWarning = ref<string | null>(null);

  async function fetchProfile() {
    loading.value = true;
    error.value = null;
    try {
      profileData.value = await api.getProfile();
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Error al cargar el perfil';
    } finally {
      loading.value = false;
    }
  }

  async function saveProfile(dto: UpdateProfileDto) {
    loading.value = true;
    error.value = null;
    try {
      profileData.value = await api.updateProfile(dto);
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Error al guardar el perfil';
    } finally {
      loading.value = false;
    }
  }

  async function saveLocation(dto: UpdateLocationDto) {
    loading.value = true;
    error.value = null;
    geocodingWarning.value = null;
    try {
      const result = await api.updateLocation(dto);
      if (profileData.value) {
        profileData.value = {
          ...profileData.value,
          address: result.address,
          latitude: result.latitude,
          longitude: result.longitude,
        };
      }
      geocodingWarning.value = result.geocodingWarning ?? null;
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Error al guardar la ubicación';
    } finally {
      loading.value = false;
    }
  }

  async function geocodeAddress(address: string) {
    return api.geocodeAddress(address);
  }

  async function uploadLogo(file: File) {
    loading.value = true;
    uploadProgress.value = 0;
    error.value = null;
    try {
      const result = await api.uploadImage('logo', file);
      uploadProgress.value = 100;
      if (profileData.value) {
        profileData.value = { ...profileData.value, logoUrl: result.url };
      }
    } catch (err: unknown) {
      error.value = uploadErrorMessage(err, 'Error al subir el logo');
    } finally {
      loading.value = false;
    }
  }

  async function uploadBanner(file: File) {
    loading.value = true;
    uploadProgress.value = 0;
    error.value = null;
    try {
      const result = await api.uploadImage('banner', file);
      uploadProgress.value = 100;
      if (profileData.value) {
        profileData.value = { ...profileData.value, bannerUrl: result.url };
      }
    } catch (err: unknown) {
      error.value = uploadErrorMessage(err, 'Error al subir el banner');
    } finally {
      loading.value = false;
    }
  }

  async function fetchImageHistory() {
    loading.value = true;
    error.value = null;
    try {
      imageHistory.value = await api.getImageHistory();
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Error al cargar el historial de imágenes';
    } finally {
      loading.value = false;
    }
  }

  return {
    profileData,
    imageHistory,
    loading,
    uploadProgress,
    error,
    geocodingWarning,
    fetchProfile,
    saveProfile,
    saveLocation,
    geocodeAddress,
    uploadLogo,
    uploadBanner,
    fetchImageHistory,
  };
});
