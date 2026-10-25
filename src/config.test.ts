import { describe, expect, it } from 'vitest';
import { ConfigError, parseConfig } from './config';

describe('parseConfig', () => {
  // protects=env validation; fails_when=a missing Supabase var is accepted silently; no_claim=values are reachable
  it('names the missing variable in supabase mode', () => {
    expect(() =>
      parseConfig({ VITE_DATA_MODE: 'supabase', VITE_SUPABASE_URL: 'http://x' }),
    ).toThrow(
      new ConfigError(
        'Missing env var VITE_SUPABASE_ANON_KEY. Run "pnpm env:local" (local stack) or use "pnpm dev:mem".',
      ),
    );
  });

  // protects=Docker-less dev; fails_when=memory mode requires Supabase vars; no_claim=memory repositories work
  it('accepts memory mode without Supabase vars', () => {
    expect(parseConfig({ VITE_DATA_MODE: 'memory' }).dataMode).toBe('memory');
  });

  // protects=test handle gating; fails_when=the handle is enabled in a plain production env; no_claim=the bundle omits it
  it('enables the test handle only in dev or e2e', () => {
    expect(parseConfig({ VITE_DATA_MODE: 'memory', DEV: false }).testHandle).toBe(false);
    expect(parseConfig({ VITE_DATA_MODE: 'memory', DEV: true }).testHandle).toBe(true);
    expect(parseConfig({ VITE_DATA_MODE: 'memory', VITE_E2E: 'true' }).testHandle).toBe(true);
  });
});
