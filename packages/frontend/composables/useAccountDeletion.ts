import { ref } from 'vue';
import type { AccountDeletionStatus, RequestAccountDeletion } from '@agendly/shared';

/**
 * Owner self-service account deletion (30-day grace period). After a request or
 * a reactivation the session profile is reloaded, so the auth middleware and
 * the store see the new tenant state (isActive / deletionScheduledAt).
 */
export function useAccountDeletion() {
  const api = useApi();
  const { fetchMe } = useAuth();

  const status = ref<AccountDeletionStatus | null>(null);
  const loading = ref(false);
  const error = ref('');

  function messageOf(e: unknown, fallback: string): string {
    const message = (e as { data?: { message?: string | string[] } }).data?.message;
    return (Array.isArray(message) ? message[0] : message) || fallback;
  }

  async function load() {
    error.value = '';
    try {
      status.value = await api.get<AccountDeletionStatus>('/account/deletion');
    } catch {
      error.value = 'No se pudo cargar el estado de tu cuenta.';
    }
  }

  async function requestDeletion(body: RequestAccountDeletion): Promise<boolean> {
    loading.value = true;
    error.value = '';
    try {
      status.value = await api.post<AccountDeletionStatus>('/account/deletion', { ...body });
      await fetchMe();
      return true;
    } catch (e) {
      error.value = messageOf(e, 'No se pudo programar la eliminación. Intenta de nuevo.');
      return false;
    } finally {
      loading.value = false;
    }
  }

  async function cancelDeletion(): Promise<boolean> {
    loading.value = true;
    error.value = '';
    try {
      status.value = await api.del<AccountDeletionStatus>('/account/deletion');
      await fetchMe();
      return true;
    } catch (e) {
      error.value = messageOf(e, 'No se pudo reactivar tu cuenta. Intenta de nuevo.');
      return false;
    } finally {
      loading.value = false;
    }
  }

  return { status, loading, error, load, requestDeletion, cancelDeletion };
}
