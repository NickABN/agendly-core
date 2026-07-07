import { fileURLToPath } from 'node:url';
import {
  isProductionNetlifyDeploy,
  validateNetlifyInternalApiUrl,
  validateProductionPublicApiUrl,
} from './config/runtime-config-validation';

function publicApiUrl(): string {
  const value = process.env.NUXT_PUBLIC_API_URL || 'http://localhost:3000';

  if (isProductionNetlifyDeploy()) {
    validateProductionPublicApiUrl(process.env.NUXT_PUBLIC_API_URL);
  }

  return value;
}

function internalApiUrl(): string {
  const value = process.env.NUXT_API_URL_INTERNAL || '';

  if (isProductionNetlifyDeploy()) {
    validateNetlifyInternalApiUrl(value);
  }

  return value;
}

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-03-19',
  devtools: { enabled: true },

  modules: ['@nuxt/ui', '@pinia/nuxt'],

  // Consume @agendly/shared from SOURCE: its dist is CommonJS and Vite can't
  // expose named value exports from it (types alone never hit this).
  alias: {
    '@agendly/shared': fileURLToPath(new URL('../shared/src/index.ts', import.meta.url)),
  },

  app: {
    head: {
      link: [
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap',
        },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200',
        },
      ],
    },
  },

  runtimeConfig: {
    // Server-side base for SSR fetches. In local Docker the Nuxt server reaches
    // the backend over the compose network (http://backend:3000); the browser
    // uses `public.apiUrl` instead. Empty in prod → falls back to public.apiUrl.
    // Key `apiUrlInternal` maps to env NUXT_API_URL_INTERNAL at runtime.
    apiUrlInternal: internalApiUrl(),
    public: {
      apiUrl: publicApiUrl(),
      // Error tracking (opcional; sin DSN el plugin de Sentry queda no-op)
      sentryDsn: process.env.NUXT_PUBLIC_SENTRY_DSN || '',
    },
  },

  css: ['~/assets/css/main.css'],
});
