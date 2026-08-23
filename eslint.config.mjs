import eslint from '@eslint/js';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/coverage/**',
      '**/node_modules/**',
      'legacy/**',
      'index.html',
      'server*.js',
      'auth.js',
      'db.js',
      'message-result.js',
      'permissions.js',
      'storage.js',
      'scripts/**',
      'tests/**',
      'apps/web/tests/**',
      'outputs/**',
      '*.config.ts',
      '*.config.mts',
      'apps/*/*.config.ts',
      'apps/*/*.config.mts',
      'eslint.config.mjs',
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  prettier,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
      globals: { ...globals.node, ...globals.browser },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
    },
  },
  {
    files: ['**/*.spec.ts', '**/*.test.ts'],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
    },
  },
  { files: ['apps/web/src/api/*.ts'], rules: { '@typescript-eslint/no-unsafe-return': 'off' } },
  { files: ['apps/web/src/main.ts'], rules: { '@typescript-eslint/no-unsafe-argument': 'off' } },
  {
    files: ['apps/api/test/**/*.ts'],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
    },
  },
);
