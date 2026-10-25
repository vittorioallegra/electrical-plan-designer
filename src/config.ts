import { z } from 'zod';

const envSchema = z
  .object({
    VITE_DATA_MODE: z.enum(['supabase', 'memory']).default('supabase'),
    VITE_SUPABASE_URL: z.string().optional(),
    VITE_SUPABASE_ANON_KEY: z.string().optional(),
    VITE_E2E: z.string().optional(),
    DEV: z.boolean().optional(),
  })
  .transform((env) => ({
    dataMode: env.VITE_DATA_MODE,
    supabaseUrl: env.VITE_SUPABASE_URL ?? '',
    supabaseAnonKey: env.VITE_SUPABASE_ANON_KEY ?? '',
    testHandle: env.DEV === true || env.VITE_E2E === 'true',
  }));

export type AppConfig = z.output<typeof envSchema>;

export class ConfigError extends Error {
  override name = 'ConfigError';
}

/** Validates the Vite env; throws naming the first missing variable. */
export function parseConfig(env: Record<string, unknown>): AppConfig {
  const config = envSchema.parse(env);
  if (config.dataMode === 'supabase') {
    for (const [key, value] of [
      ['VITE_SUPABASE_URL', config.supabaseUrl],
      ['VITE_SUPABASE_ANON_KEY', config.supabaseAnonKey],
    ] as const) {
      if (!value) {
        throw new ConfigError(
          `Missing env var ${key}. Run "pnpm env:local" (local stack) or use "pnpm dev:mem".`,
        );
      }
    }
  }
  return config;
}

let cached: AppConfig | undefined;

export function getConfig(): AppConfig {
  cached ??= parseConfig(import.meta.env);
  return cached;
}
