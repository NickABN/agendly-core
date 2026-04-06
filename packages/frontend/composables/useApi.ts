import { useAuthStore } from '~/stores/auth';

export function useApi() {
  const config = useRuntimeConfig();
  const store = useAuthStore();
  const apiUrl = config.public.apiUrl;

  function authHeaders(): Record<string, string> {
    return store.token ? { Authorization: `Bearer ${store.token}` } : {};
  }

  async function get<T>(path: string) {
    return $fetch<T>(`${apiUrl}${path}`, {
      headers: authHeaders(),
    });
  }

  async function post<T>(path: string, body?: Record<string, unknown> | unknown[]) {
    return $fetch<T>(`${apiUrl}${path}`, {
      method: 'POST',
      body: body as Record<string, unknown>,
      headers: authHeaders(),
    });
  }

  async function patch<T>(path: string, body?: Record<string, unknown> | unknown[]) {
    return $fetch<T>(`${apiUrl}${path}`, {
      method: 'PATCH',
      body: body as Record<string, unknown>,
      headers: authHeaders(),
    });
  }

  async function put<T>(path: string, body?: Record<string, unknown> | unknown[]) {
    return $fetch<T>(`${apiUrl}${path}`, {
      method: 'PUT',
      body: body as Record<string, unknown>,
      headers: authHeaders(),
    });
  }

  async function del<T>(path: string) {
    return $fetch<T>(`${apiUrl}${path}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
  }

  return { get, post, patch, put, del };
}
