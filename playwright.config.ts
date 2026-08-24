import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:5174';
const useExistingServer = process.env.E2E_USE_EXISTING_SERVER === 'true';

export default defineConfig({
  testDir: './apps/web/tests',
  testMatch: '**/*.e2e-spec.ts',
  timeout: 30_000,
  fullyParallel: true,
  workers: process.env.CI ? 1 : undefined,
  use: { baseURL, trace: 'retain-on-failure' },
  webServer: useExistingServer
    ? undefined
    : [
        {
          command: 'npm run dev -w @pmp/api',
          url: 'http://127.0.0.1:3000/health',
          reuseExistingServer: false,
          timeout: 120_000,
          env: {
            ...process.env,
            NODE_ENV: 'test',
            AI_ENABLED: 'false',
            AI_FAKE_ENABLED: 'true',
            COOKIE_SECURE: 'false',
          },
        },
        {
          command:
            'npm run build -w @pmp/shared-types && npm run build -w @pmp/shared-constants && npm run build -w @pmp/shared-utils && npm run build -w @pmp/web && npm run preview -w @pmp/web -- --port 5174',
          url: 'http://127.0.0.1:5174',
          reuseExistingServer: false,
          timeout: 120_000,
        },
      ],
  projects: [
    {
      name: 'desktop',
      testMatch: '**/*.e2e-spec.ts',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'small-phone',
      testMatch: '**/core-navigation.e2e-spec.ts',
      use: {
        browserName: 'chromium',
        viewport: { width: 375, height: 812 },
        hasTouch: true,
        isMobile: true,
      },
    },
    {
      name: 'phone-landscape',
      testMatch: '**/core-navigation.e2e-spec.ts',
      use: {
        browserName: 'chromium',
        viewport: { width: 844, height: 390 },
        hasTouch: true,
        isMobile: true,
      },
    },
  ],
});
