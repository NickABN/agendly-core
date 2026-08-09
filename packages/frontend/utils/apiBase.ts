/**
 * Base URL for backend calls, correct on both sides of SSR.
 *
 * During SSR inside Docker, the Nuxt server must reach the backend over the
 * internal network (http://backend:3000), which the browser cannot resolve.
 * On the client it uses the public URL. Netlify production leaves the internal
 * URL empty so both browser and SSR calls use the same-origin `/api` Nitro proxy.
 * Use this for any fetch that may run server-side (useAsyncData); client-only
 * calls can keep using `config.public.apiUrl` directly.
 */
export function apiBase(): string {
  const config = useRuntimeConfig();
  if (import.meta.server && config.apiUrlInternal) {
    return config.apiUrlInternal as string;
  }
  return config.public.apiUrl;
}
