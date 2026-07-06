import * as Sentry from '@sentry/vue';

/**
 * Error tracking del frontend (solo cliente). Sin NUXT_PUBLIC_SENTRY_DSN queda
 * en no-op (dev/PoC sin cuenta). Captura errores de Vue y no manejados.
 */
export default defineNuxtPlugin((nuxtApp) => {
  const dsn = useRuntimeConfig().public.sentryDsn;
  if (!dsn) return;

  Sentry.init({
    app: nuxtApp.vueApp,
    dsn,
    environment: import.meta.dev ? 'development' : 'production',
    tracesSampleRate: 0, // solo error tracking en el PoC
  });
});
