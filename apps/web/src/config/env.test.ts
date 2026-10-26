import { describe, expect, it } from 'vitest';
import { parseConfig } from './env';

describe('parseConfig', () => {
  // protects=test handle gating; fails_when=the handle is enabled in a plain production env; no_claim=the bundle omits it
  it('enables the test handle only in dev or e2e', () => {
    expect(parseConfig({ DEV: false }).testHandle).toBe(false);
    expect(parseConfig({ DEV: true }).testHandle).toBe(true);
    expect(parseConfig({ VITE_E2E: 'true' }).testHandle).toBe(true);
  });
});
