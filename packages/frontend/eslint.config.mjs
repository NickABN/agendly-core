// @ts-check
import prettier from 'eslint-config-prettier';
import withNuxt from './.nuxt/eslint.config.mjs';

// Formatting is owned by Prettier (`pnpm format`); eslint-config-prettier turns off
// stylistic rules that would conflict with it.
export default withNuxt(prettier, {
  rules: {
    // Same convention as the backend: intentionally unused args/vars start with _
    '@typescript-eslint/no-unused-vars': [
      'error',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],
  },
});
