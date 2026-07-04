import { ref } from 'vue';

export interface ServiceItem {
  id: string;
  name: string;
  durationMinutes: number;
  bufferMinutes: number;
  priceMXN: string;
  isActive: boolean;
}

/** Service CRUD. Pages/components never call useApi() for services directly. */
export function useServices() {
  const api = useApi();

  const items = ref<ServiceItem[]>([]);
  const pending = ref(false);
  const error = ref('');

  async function load() {
    pending.value = true;
    error.value = '';
    try {
      items.value = await api.get<ServiceItem[]>('/services');
    } catch {
      error.value = 'No se pudieron cargar los servicios.';
    } finally {
      pending.value = false;
    }
  }

  async function create(data: {
    name: string;
    durationMinutes: number;
    bufferMinutes?: number;
    priceMXN: number;
  }) {
    const created = await api.post<ServiceItem>('/services', data);
    items.value.push(created);
    return created;
  }

  async function update(
    id: string,
    data: Partial<{
      name: string;
      durationMinutes: number;
      bufferMinutes: number;
      priceMXN: number;
      isActive: boolean;
    }>,
  ) {
    const updated = await api.patch<ServiceItem>(`/services/${id}`, data);
    const index = items.value.findIndex((s) => s.id === id);
    if (index !== -1) items.value[index] = updated;
    return updated;
  }

  async function remove(id: string) {
    await api.del(`/services/${id}`);
    items.value = items.value.filter((s) => s.id !== id);
  }

  async function getAvailability(id: string) {
    return api.get<ServiceAvailabilityItem[]>(`/services/${id}/availability`);
  }

  async function setAvailability(id: string, availability: ServiceAvailabilityItem[]) {
    return api.put(`/services/${id}/availability`, availability);
  }

  return { items, pending, error, load, create, update, remove, getAvailability, setAvailability };
}

export interface ServiceAvailabilityItem {
  dayOfWeek: string;
  startTime: string | null;
  endTime: string | null;
}
