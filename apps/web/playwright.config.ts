import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  reporter: process.env.CI ? 'dot' : 'line',
  use: { trace: 'retain-on-failure' },
  projects: [
    {
      name: 'chromium',
      testIgnore: /offline\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:5174' },
    },
    {
      // The service worker exists only in a production build.
      name: 'offline',
      testMatch: /offline\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:5175' },
    },
  ],
  webServer: [
    {
      // Own port so a running `pnpm dev` server is never reused by mistake.
      command: 'pnpm exec vite --mode e2e --port 5174',
      url: 'http://localhost:5174',
      reuseExistingServer: false,
    },
    {
      command:
        'pnpm exec vite build --mode e2e --outDir dist-e2e --emptyOutDir --logLevel warn && pnpm exec vite preview --mode e2e --outDir dist-e2e --port 5175 --strictPort',
      url: 'http://localhost:5175',
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
