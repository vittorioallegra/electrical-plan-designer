import { z } from 'zod';

const envSchema = z
  .object({
    VITE_E2E: z.string().optional(),
    DEV: z.boolean().optional(),
  })
  .transform((env) => ({
    testHandle: env.DEV === true || env.VITE_E2E === 'true',
    /** E2E builds open and save through an in-memory fake (`window.__epd.files`). */
    fakeFiles: env.VITE_E2E === 'true',
  }));

export type AppConfig = z.output<typeof envSchema>;

/** Validates the Vite env. */
export function parseConfig(env: Record<string, unknown>): AppConfig {
  return envSchema.parse(env);
}

let cached: AppConfig | undefined;

export function getConfig(): AppConfig {
  cached ??= parseConfig(import.meta.env);
  return cached;
}
