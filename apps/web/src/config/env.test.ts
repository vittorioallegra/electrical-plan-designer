import { describe, expect, it } from 'vitest';
import { parseConfig } from './env';

describe('parseConfig', () => {
  // protects=test handle and fake files gating; fails_when=the handle or the fake file access is enabled outside dev or E2E builds; no_claim=the bundle omits them
  it('enables the test handle only in dev or e2e', () => {
    expect(parseConfig({ DEV: false }).testHandle).toBe(false);
    expect(parseConfig({ DEV: true }).testHandle).toBe(true);
    expect(parseConfig({ VITE_E2E: 'true' }).testHandle).toBe(true);
    expect(parseConfig({ DEV: true }).fakeFiles).toBe(false);
    expect(parseConfig({ VITE_E2E: 'true' }).fakeFiles).toBe(true);
  });
});
