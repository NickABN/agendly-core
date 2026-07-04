import { fileURLToPath } from 'node:url';

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
    public: {
      apiUrl: process.env.NUXT_PUBLIC_API_URL || 'http://localhost:3000',
    },
  },

  css: ['~/assets/css/main.css'],
});
