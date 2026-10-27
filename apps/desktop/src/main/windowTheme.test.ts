import { describe, expect, it } from 'vitest';
import { followTheme, windowBackground } from './windowTheme';

function fakeTheme() {
  const listeners = new Set<() => void>();
  return {
    shouldUseDarkColors: false,
    on: (_event: 'updated', listener: () => void) => listeners.add(listener),
    off: (_event: 'updated', listener: () => void) => listeners.delete(listener),
    emit() {
      listeners.forEach((l) => l());
    },
    listeners,
  };
}

describe('window background', () => {
  // protects=window background follows the theme; fails_when=an open window keeps the colour of the theme it was created with after the theme updates, a destroyed window is painted, or stopping leaves the listener; no_claim=the real nativeTheme events (Electron E2E)
  it('repaints the window when the theme updates and stops when asked', () => {
    const theme = fakeTheme();
    const painted: string[] = [];
    let destroyed = false;
    const stop = followTheme(
      { setBackgroundColor: (c) => painted.push(c), isDestroyed: () => destroyed },
      theme,
    );
    theme.shouldUseDarkColors = true;
    theme.emit();
    theme.shouldUseDarkColors = false;
    theme.emit();
    expect(painted).toEqual([windowBackground(true), windowBackground(false)]);
    expect(windowBackground(true)).not.toBe(windowBackground(false));
    destroyed = true;
    theme.emit();
    expect(painted).toHaveLength(2);
    stop();
    expect(theme.listeners.size).toBe(0);
  });
});
