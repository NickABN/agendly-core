import { useAuthStore } from '~/stores/auth';

export function useApi() {
  const config = useRuntimeConfig();
  const store = useAuthStore();
  const apiUrl = config.public.apiUrl;

  function authHeaders() {
    return store.token
      ? { Authorization: `Bearer ${store.token}` }
      : {};
  }

  async function get<T>(path: string) {
    return $fetch<T>(`${apiUrl}${path}`, {
      headers: authHeaders(),
    });
  }

  async function post<T>(path: string, body?: unknown) {
    return $fetch<T>(`${apiUrl}${path}`, {
      method: 'POST',
      body,
      headers: authHeaders(),
    });
  }

  async function patch<T>(path: string, body?: unknown) {
    return $fetch<T>(`${apiUrl}${path}`, {
      method: 'PATCH',
      body,
      headers: authHeaders(),
    });
  }

  async function put<T>(path: string, body?: unknown) {
    return $fetch<T>(`${apiUrl}${path}`, {
      method: 'PUT',
      body,
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
