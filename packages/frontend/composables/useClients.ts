import { computed, ref } from 'vue';

export interface ClientItem {
  name: string;
  phone: string;
  email: string | null;
  totalVisits: number;
  completedVisits: number;
  cancelledVisits: number;
  noShowVisits: number;
  lastVisit: string;
  topService: string;
}

/** Client CRM read-model with search + aggregate stats. */
export function useClients() {
  const api = useApi();

  const items = ref<ClientItem[]>([]);
  const pending = ref(false);
  const error = ref('');
  const search = ref('');

  async function load() {
    pending.value = true;
    error.value = '';
    try {
      items.value = await api.get<ClientItem[]>('/appointments/clients');
    } catch {
      error.value = 'No se pudieron cargar los clientes.';
    } finally {
      pending.value = false;
    }
  }

  const filtered = computed(() => {
    if (!search.value) return items.value;
    const q = search.value.toLowerCase();
    return items.value.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        (c.email && c.email.toLowerCase().includes(q)),
    );
  });

  const totalVisits = computed(() => items.value.reduce((a, c) => a + c.totalVisits, 0));
  const avgVisits = computed(() =>
    items.value.length ? (totalVisits.value / items.value.length).toFixed(1) : '0',
  );
  const topClient = computed(() => items.value[0]?.name || '—');

  return { items, pending, error, search, filtered, totalVisits, avgVisits, topClient, load };
}
