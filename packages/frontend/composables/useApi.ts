import * as Sentry from '@sentry/vue';

export function useApi() {
  // apiBase(): URL interna del backend en SSR, pública en el cliente.
  const apiUrl = apiBase();
  // En SSR reenviamos la cookie entrante al backend (el navegador solo la adjunta
  // en el cliente); en el cliente `credentials: 'include'` la manda automáticamente.
  const ssrHeaders = import.meta.server ? useRequestHeaders(['cookie']) : {};

  // Instancia con auth por cookie httpOnly + interceptor central de errores: los
  // 5xx (fallas del servidor) se reportan a Sentry; los 4xx los maneja el llamador.
  const client = $fetch.create({
    baseURL: apiUrl,
    credentials: 'include',
    headers: ssrHeaders,
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
    return client<T>(path);
  }

  function post<T>(path: string, body?: Record<string, unknown> | unknown[] | FormData) {
    return client<T>(path, { method: 'POST', body: body as Record<string, unknown> });
  }

  function patch<T>(path: string, body?: Record<string, unknown> | unknown[] | FormData) {
    return client<T>(path, { method: 'PATCH', body: body as Record<string, unknown> });
  }

  function put<T>(path: string, body?: Record<string, unknown> | unknown[] | FormData) {
    return client<T>(path, { method: 'PUT', body: body as Record<string, unknown> });
  }

  function del<T>(path: string) {
    return client<T>(path, { method: 'DELETE' });
  }

  return { get, post, patch, put, del };
}
