import { ref } from 'vue';

export interface EmployeeItem {
  id: string;
  name: string;
  isActive: boolean;
  serviceIds: string[];
}

/** Employee CRUD. Pages/components never call useApi() for employees directly. */
export function useEmployees() {
  const api = useApi();

  const items = ref<EmployeeItem[]>([]);
  const pending = ref(false);
  const error = ref('');

  async function load() {
    pending.value = true;
    error.value = '';
    try {
      items.value = await api.get<EmployeeItem[]>('/employees');
    } catch {
      error.value = 'No se pudo cargar el personal.';
    } finally {
      pending.value = false;
    }
  }

  async function create(data: { name: string; serviceIds?: string[] }) {
    const created = await api.post<EmployeeItem>('/employees', data);
    items.value.push(created);
    return created;
  }

  async function update(
    id: string,
    data: Partial<{ name: string; isActive: boolean; serviceIds: string[] }>,
  ) {
    const updated = await api.patch<EmployeeItem>(`/employees/${id}`, data);
    const index = items.value.findIndex((e) => e.id === id);
    if (index !== -1) items.value[index] = updated;
    return updated;
  }

  async function remove(id: string) {
    await api.del(`/employees/${id}`);
    items.value = items.value.filter((e) => e.id !== id);
  }

  return { items, pending, error, load, create, update, remove };
}
