import * as Sentry from '@sentry/vue';
import { useAuthStore } from '~/stores/auth';

export function useApi() {
  const config = useRuntimeConfig();
  const store = useAuthStore();
  const apiUrl = config.public.apiUrl;

  function authHeaders(): Record<string, string> {
    return store.token ? { Authorization: `Bearer ${store.token}` } : {};
  }

  // Instancia con interceptor central de errores: los 5xx (fallas del servidor)
  // se reportan a Sentry con contexto; los 4xx los maneja el llamador.
  const client = $fetch.create({
    baseURL: apiUrl,
    onResponseError({ request, response }) {
      const status = response.status;
      if (status >= 500) {
        Sentry.captureException(
          new Error(`API ${status} en ${String(request)}`),
          { extra: { status, body: response._data } },
        );
      }
    },
  });

  function get<T>(path: string) {
    return client<T>(path, { headers: authHeaders() });
  }

  function post<T>(path: string, body?: Record<string, unknown> | unknown[] | FormData) {
    return client<T>(path, {
      method: 'POST',
      body: body as Record<string, unknown>,
      headers: authHeaders(),
    });
  }

  function patch<T>(path: string, body?: Record<string, unknown> | unknown[] | FormData) {
    return client<T>(path, {
      method: 'PATCH',
      body: body as Record<string, unknown>,
      headers: authHeaders(),
    });
  }

  function put<T>(path: string, body?: Record<string, unknown> | unknown[] | FormData) {
    return client<T>(path, {
      method: 'PUT',
      body: body as Record<string, unknown>,
      headers: authHeaders(),
    });
  }

  function del<T>(path: string) {
    return client<T>(path, { method: 'DELETE', headers: authHeaders() });
  }

  return { get, post, patch, put, del };
}
