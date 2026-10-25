import { fileURLToPath } from 'node:url';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

// Integration tests against the local Supabase stack (needs Docker).
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.db.test.ts'],
    env: loadEnv('development', process.cwd(), ''),
    fileParallelism: false,
  },
});
