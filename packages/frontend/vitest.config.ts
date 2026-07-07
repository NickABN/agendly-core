import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    allowOnly: false,
    environment: 'node',
    globals: true,
  },
  // Los unit tests de composables modelan el lado cliente (el gating import.meta.client
  // del interceptor de refresh). En SSR ese código no corre.
  define: {
    'import.meta.client': 'true',
    'import.meta.server': 'false',
  },
  resolve: {
    alias: {
      '~': resolve(__dirname, '.'),
      '@agendly/shared': resolve(__dirname, '../shared/src/index.ts'),
    },
  },
});
