import { ref } from 'vue';
import type { PublicDirectoryBusinessDto, PublicDirectoryResponse } from '@agendly/shared';

/** Fetches the opt-in public business directory and owns its request state. */
export function usePublicDirectory() {
  const api = useApi();
  const businesses = ref<PublicDirectoryBusinessDto[]>([]);
  const loading = ref(true);
  const error = ref(false);
  let requestId = 0;

  async function load(q?: string) {
    const currentRequestId = ++requestId;
    const query = q?.trim();
    const path = query ? `/public/directory?q=${encodeURIComponent(query)}` : '/public/directory';
    loading.value = true;
    error.value = false;

    try {
      const response = await api.get<PublicDirectoryResponse>(path);
      if (currentRequestId === requestId) businesses.value = response.businesses;
    } catch {
      if (currentRequestId === requestId) {
        businesses.value = [];
        error.value = true;
      }
    } finally {
      if (currentRequestId === requestId) loading.value = false;
    }
  }

  return { businesses, loading, error, load };
}
