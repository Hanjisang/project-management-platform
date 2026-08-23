import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/**/*.spec.ts', 'apps/api/src/**/*.spec.ts', 'apps/web/src/**/*.spec.ts'],
    exclude: ['**/*.integration-spec.ts', '**/*.e2e-spec.ts', '**/node_modules/**', '**/dist/**'],
    environment: 'node',
    coverage: { provider: 'v8', reporter: ['text', 'lcov'] },
  },
});
