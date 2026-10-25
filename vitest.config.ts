import { defineConfig } from 'vitest/config';

// Workspace test projects, so `pnpm exec vitest run <file>` works from the repo root.
export default defineConfig({
  test: {
    projects: [
      'apps/web/vite.config.ts',
      'packages/domain/vitest.config.ts',
      {
        test: {
          name: 'repo',
          environment: 'node',
          include: ['scripts/**/*.test.ts', 'tests/**/*.test.ts'],
          testTimeout: 30_000,
        },
      },
    ],
  },
});
