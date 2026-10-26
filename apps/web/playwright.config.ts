import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  reporter: process.env.CI ? 'dot' : 'line',
  use: { trace: 'retain-on-failure' },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:5174' },
    },
  ],
  webServer: [
    {
      // Own port so a running `pnpm dev` server is never reused by mistake.
      command: 'pnpm exec vite --mode e2e --port 5174',
      url: 'http://localhost:5174',
      reuseExistingServer: false,
    },
  ],
});
