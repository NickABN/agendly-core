import { ref } from 'vue';

export interface ScheduleBlock {
  dayOfWeek: string;
  blockIndex: number;
  startTime: string;
  endTime: string;
}

/** Weekly schedule blocks per employee. */
export function useSchedules() {
  const api = useApi();

  const blocks = ref<ScheduleBlock[]>([]);
  const pending = ref(false);
  const saving = ref(false);

  async function loadForEmployee(employeeId: string, fallback: ScheduleBlock[] = []) {
    pending.value = true;
    try {
      const data = await api.get<ScheduleBlock[]>(`/schedules/employee/${employeeId}`);
      blocks.value = data.length > 0 ? data : fallback;
    } finally {
      pending.value = false;
    }
  }

  async function bulkSave(employeeId: string) {
    saving.value = true;
    try {
      await api.put('/schedules/bulk', {
        employeeId,
        days: blocks.value.map((b) => ({
          dayOfWeek: b.dayOfWeek,
          blockIndex: b.blockIndex,
          startTime: b.startTime,
          endTime: b.endTime,
        })),
      });
    } finally {
      saving.value = false;
    }
  }

  return { blocks, pending, saving, loadForEmployee, bulkSave };
}
