import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
  },
  resolve: {
    alias: {
      '~': resolve(__dirname, '.'),
      '@agendly/shared': resolve(__dirname, '../shared/src/index.ts'),
    },
  },
});
