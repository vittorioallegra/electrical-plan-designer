import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { runDash, useCanvasColors } from './canvasColors';

const tokens = {
  light: { '--color-canvas-bg': '#ffffff', '--color-canvas-run': '#5b6470' },
  dark: { '--color-canvas-bg': '#111214', '--color-canvas-run': '#a3abb6' },
};

function fakeComputedStyle() {
  vi.spyOn(window, 'getComputedStyle').mockImplementation(
    () =>
      ({
        getPropertyValue: (name: string) =>
          tokens[document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'][
            name as keyof typeof tokens.light
          ] ?? '',
      }) as CSSStyleDeclaration,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  delete document.documentElement.dataset.theme;
});

describe('canvas colors', () => {
  // protects=a live theme switch reaching the canvas; fails_when=the colors keep the previous theme's tokens after data-theme changes; no_claim=Konva drawing or the OS media query
  it('reads the tokens again when the theme changes', async () => {
    fakeComputedStyle();
    const { result } = renderHook(() => useCanvasColors());
    expect(result.current.background).toBe('#ffffff');
    expect(result.current.run).toBe('#5b6470');

    await act(async () => {
      document.documentElement.dataset.theme = 'dark';
      await Promise.resolve();
    });
    expect(result.current.background).toBe('#111214');
    expect(result.current.run).toBe('#a3abb6');
  });

  // protects=conduit laying types told apart by dash only; fails_when=two laying types share a dash pattern or a pattern drifts from DESIGN.md; no_claim=the stroke color
  it('gives each laying type its own dash pattern', () => {
    expect(runDash).toEqual({ floor: [6, 4], ceiling: [8, 3, 2, 3], direct: [2, 3] });
  });
});
