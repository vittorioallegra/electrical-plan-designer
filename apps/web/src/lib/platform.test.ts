import type { EpdBridge } from '@epd/bridge/bridge';
import { afterEach, describe, expect, it } from 'vitest';
import { getPlatform, modifierLabel } from './platform';

afterEach(() => {
  delete window.epd;
});

describe('platform', () => {
  // protects=shortcut hints per OS; fails_when=Windows or Linux show the Command symbol, or macOS shows Ctrl; no_claim=the shortcuts themselves (native menu and key handlers)
  it('takes the OS from the desktop bridge and picks the modifier label', () => {
    window.epd = { platform: 'darwin' } as EpdBridge;
    expect(getPlatform()).toBe('darwin');
    expect(modifierLabel()).toBe('⌘');
    window.epd = { platform: 'win32' } as EpdBridge;
    expect(modifierLabel()).toBe('Ctrl+');
    window.epd = { platform: 'linux' } as EpdBridge;
    expect(modifierLabel(getPlatform())).toBe('Ctrl+');
  });

  // protects=browser fallback; fails_when=without the bridge the platform is not guessed from the browser; no_claim=every user agent
  it('guesses the OS in a browser', () => {
    expect(['darwin', 'win32', 'linux']).toContain(getPlatform());
  });
});
