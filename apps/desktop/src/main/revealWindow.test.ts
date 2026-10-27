import { describe, expect, it } from 'vitest';
import { revealWindow } from './revealWindow';

function fake(minimized: boolean, visible: boolean) {
  const calls: string[] = [];
  return {
    calls,
    win: {
      isMinimized: () => minimized,
      isVisible: () => visible,
      restore: () => calls.push('restore'),
      show: () => calls.push('show'),
      focus: () => calls.push('focus'),
    },
  };
}

describe('revealWindow', () => {
  // protects=a menu command reaches a window the user can see; fails_when=a minimized or hidden window is not restored/shown before it is focused, or a visible one is needlessly restored; no_claim=the real Electron window
  it('restores a minimized window, shows a hidden one and always focuses', () => {
    const minimized = fake(true, true);
    revealWindow(minimized.win);
    expect(minimized.calls).toEqual(['restore', 'focus']);
    const hidden = fake(false, false);
    revealWindow(hidden.win);
    expect(hidden.calls).toEqual(['show', 'focus']);
    const plain = fake(false, true);
    revealWindow(plain.win);
    expect(plain.calls).toEqual(['focus']);
  });
});
