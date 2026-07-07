import * as Sentry from '@sentry/vue';
import { useAuthStore } from '~/stores/auth';

type Body = Record<string, unknown> | unknown[] | FormData;

/**
 * Lock single-flight del refresh — SOLO cliente. Nunca a nivel módulo en SSR: el
 * estado de módulo se comparte entre todos los requests del servidor → contaminación
 * cross-user. En SSR el refresh lo maneja el middleware (auth.global.ts).
 */
let refreshInFlight: Promise<boolean> | null = null;

function refreshOnce(baseURL: string): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight; // varios 401 concurrentes → 1 solo refresh
  refreshInFlight = $fetch('/auth/refresh', {
    baseURL,
    method: 'POST',
    credentials: 'include',
  })
    .then(() => true)
    .catch(() => false)
    .finally(() => {
      refreshInFlight = null;
    });
  return refreshInFlight;
}

function statusOf(err: unknown): number | undefined {
  const e = err as { response?: { status?: number }; statusCode?: number };
  return e?.response?.status ?? e?.statusCode;
}

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

  /**
   * Envuelve cada request: ante 401 en el cliente, intenta UN refresh y reintenta
   * UNA vez. Guards anti-loop: flag `retried`, exclusión de las rutas de auth, y el
   * lock single-flight. Si el refresh falla, limpia la sesión y va a /login.
   */
  async function request<T>(
    path: string,
    options: Record<string, unknown>,
    retried = false,
  ): Promise<T> {
    try {
      return await client<T>(path, options);
    } catch (err) {
      const isAuthPath =
        path.includes('/auth/refresh') || path.includes('/auth/login');
      if (statusOf(err) === 401 && import.meta.client && !retried && !isAuthPath) {
        const ok = await refreshOnce(apiUrl);
        if (ok) return request<T>(path, options, true);
        useAuthStore().clear();
        await navigateTo('/login');
      }
      throw err;
    }
  }

  function get<T>(path: string) {
    return request<T>(path, {});
  }

  function post<T>(path: string, body?: Body) {
    return request<T>(path, { method: 'POST', body });
  }

  function patch<T>(path: string, body?: Body) {
    return request<T>(path, { method: 'PATCH', body });
  }

  function put<T>(path: string, body?: Body) {
    return request<T>(path, { method: 'PUT', body });
  }

  function del<T>(path: string) {
    return request<T>(path, { method: 'DELETE' });
  }

  return { get, post, patch, put, del };
}
