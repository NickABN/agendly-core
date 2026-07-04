import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { ProfileDto, UpdateProfileDto, UpdateLocationDto, ImageVersionDto } from '@agendly/shared';
import { useProfileApi } from '~/composables/useProfileApi';

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
      error.value = err instanceof Error ? err.message : 'Error al subir el logo';
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
      error.value = err instanceof Error ? err.message : 'Error al subir el banner';
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
    uploadLogo,
    uploadBanner,
    fetchImageHistory,
  };
});
