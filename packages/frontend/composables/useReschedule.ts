import { ref } from 'vue';
import type { RescheduleRequest, RescheduleResponse, TimeSlotDto } from '@agendly/shared';

/**
 * Admin rescheduling: free slots for an existing appointment (its own current
 * range does not block itself) and the move itself. The backend emails the client.
 */
export function useReschedule() {
  const api = useApi();

  const slots = ref<TimeSlotDto[]>([]);
  const loadingSlots = ref(false);

  async function fetchSlots(appointmentId: string, date: string, employeeId: string) {
    loadingSlots.value = true;
    try {
      const query = new URLSearchParams({ date, employeeId });
      slots.value = await api.get<TimeSlotDto[]>(
        `/appointments/${appointmentId}/reschedule-slots?${query}`,
      );
    } catch {
      slots.value = [];
    } finally {
      loadingSlots.value = false;
    }
  }

  function reset() {
    slots.value = [];
  }

  function reschedule(appointmentId: string, body: RescheduleRequest) {
    return api.patch<RescheduleResponse>(`/appointments/${appointmentId}/reschedule`, { ...body });
  }

  return { slots, loadingSlots, fetchSlots, reset, reschedule };
}
