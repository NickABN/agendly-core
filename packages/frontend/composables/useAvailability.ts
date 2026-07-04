import { ref } from 'vue';

export interface AvailabilitySlot {
  /** UTC ISO instant */
  start: string;
  /** UTC ISO instant */
  end: string;
  /** Concrete employee for the slot (relevant when searching with employeeId "any") */
  employeeId?: string;
}

/**
 * Slot search against the public availability endpoint.
 * Shared by the admin manual-booking modal and the public booking flow.
 */
export function useAvailability() {
  const config = useRuntimeConfig();
  const apiUrl = config.public.apiUrl;

  const slots = ref<AvailabilitySlot[]>([]);
  const loading = ref(false);

  async function fetchSlots(params: {
    tenantSlug: string;
    employeeId: string;
    serviceId: string;
    date: string;
  }) {
    loading.value = true;
    try {
      slots.value = await $fetch<AvailabilitySlot[]>(`${apiUrl}/availability/slots`, {
        params,
      });
    } catch {
      slots.value = [];
    } finally {
      loading.value = false;
    }
  }

  function reset() {
    slots.value = [];
  }

  return { slots, loading, fetchSlots, reset };
}
