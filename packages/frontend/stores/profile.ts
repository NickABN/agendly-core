import { defineStore } from 'pinia';
import type { ProfileDto, UpdateProfileDto, UpdateLocationDto, ImageVersionDto } from '@agendly/shared';
import { useProfileApi } from '~/composables/useProfileApi';

interface ProfileState {
  profileData: ProfileDto | null;
  imageHistory: ImageVersionDto[];
  loading: boolean;
  uploadProgress: number;
  error: string | null;
  geocodingWarning: string | null;
}

export const useProfileStore = defineStore('profile', {
  state: (): ProfileState => ({
    profileData: null,
    imageHistory: [],
    loading: false,
    uploadProgress: 0,
    error: null,
    geocodingWarning: null,
  }),

  actions: {
    async fetchProfile() {
      this.loading = true;
      this.error = null;
      try {
        const api = useProfileApi();
        this.profileData = await api.getProfile();
      } catch (err: unknown) {
        this.error = err instanceof Error ? err.message : 'Error al cargar el perfil';
      } finally {
        this.loading = false;
      }
    },

    async saveProfile(dto: UpdateProfileDto) {
      this.loading = true;
      this.error = null;
      try {
        const api = useProfileApi();
        this.profileData = await api.updateProfile(dto);
      } catch (err: unknown) {
        this.error = err instanceof Error ? err.message : 'Error al guardar el perfil';
      } finally {
        this.loading = false;
      }
    },

    async saveLocation(dto: UpdateLocationDto) {
      this.loading = true;
      this.error = null;
      this.geocodingWarning = null;
      try {
        const api = useProfileApi();
        const result = await api.updateLocation(dto);
        if (this.profileData) {
          this.profileData = {
            ...this.profileData,
            address: result.address,
            latitude: result.latitude,
            longitude: result.longitude,
          };
        }
        this.geocodingWarning = result.geocodingWarning ?? null;
      } catch (err: unknown) {
        this.error = err instanceof Error ? err.message : 'Error al guardar la ubicación';
      } finally {
        this.loading = false;
      }
    },

    async uploadLogo(file: File) {
      this.loading = true;
      this.uploadProgress = 0;
      this.error = null;
      try {
        const api = useProfileApi();
        const result = await api.uploadImage('logo', file);
        this.uploadProgress = 100;
        if (this.profileData) {
          this.profileData = { ...this.profileData, logoUrl: result.url };
        }
      } catch (err: unknown) {
        this.error = err instanceof Error ? err.message : 'Error al subir el logo';
      } finally {
        this.loading = false;
      }
    },

    async uploadBanner(file: File) {
      this.loading = true;
      this.uploadProgress = 0;
      this.error = null;
      try {
        const api = useProfileApi();
        const result = await api.uploadImage('banner', file);
        this.uploadProgress = 100;
        if (this.profileData) {
          this.profileData = { ...this.profileData, bannerUrl: result.url };
        }
      } catch (err: unknown) {
        this.error = err instanceof Error ? err.message : 'Error al subir el banner';
      } finally {
        this.loading = false;
      }
    },

    async fetchImageHistory() {
      this.loading = true;
      this.error = null;
      try {
        const api = useProfileApi();
        this.imageHistory = await api.getImageHistory();
      } catch (err: unknown) {
        this.error = err instanceof Error ? err.message : 'Error al cargar el historial de imágenes';
      } finally {
        this.loading = false;
      }
    },
  },
});
