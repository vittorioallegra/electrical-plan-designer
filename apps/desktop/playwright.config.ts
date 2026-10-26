import { defineConfig } from '@playwright/test';

// Runs against the built app (`pnpm --filter @epd/desktop build`, done by `pnpm test:e2e:desktop`).
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  workers: 1,
  reporter: process.env.CI ? 'dot' : 'line',
  timeout: 60_000,
  use: { trace: 'retain-on-failure' },
  projects: [{ name: 'electron' }],
});
