import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Workspace test projects, so `pnpm exec vitest run <file>` works from the repo root.
export default defineConfig({
  test: {
    projects: [
      'apps/web/vite.config.ts',
      {
        resolve: {
          alias: { '@': fileURLToPath(new URL('./apps/web/src', import.meta.url)) },
        },
        test: { name: 'scripts', environment: 'node', include: ['scripts/**/*.test.ts'] },
      },
    ],
  },
});
