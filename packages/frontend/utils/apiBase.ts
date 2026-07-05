/**
 * Base URL for backend calls, correct on both sides of SSR.
 *
 * During SSR inside Docker, the Nuxt server must reach the backend over the
 * internal network (http://backend:3000), which the browser cannot resolve.
 * On the client (and in prod, where apiInternalUrl is empty) it uses the
 * public URL. Use this for any fetch that may run server-side (useAsyncData);
 * client-only calls can keep using `config.public.apiUrl` directly.
 */
export function apiBase(): string {
  const config = useRuntimeConfig();
  if (import.meta.server && config.apiUrlInternal) {
    return config.apiUrlInternal as string;
  }
  return config.public.apiUrl;
}
