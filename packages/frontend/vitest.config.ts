import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';

export default defineConfig({
  // Compiles .vue SFCs so component behavior specs can mount pages/components.
  // Specs that mount must opt into jsdom with `// @vitest-environment jsdom`.
  plugins: [vue()],
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
