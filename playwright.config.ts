import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  reporter: process.env.CI ? 'dot' : 'line',
  use: {
    baseURL: 'http://localhost:5174',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // Own port so a running `pnpm dev` / `dev:mem` server is never reused by mistake.
    command: 'pnpm exec vite --mode e2e --port 5174',
    url: 'http://localhost:5174',
    reuseExistingServer: false,
  },
});
