import { useEffect, useMemo, useState } from 'react';
import type { RunElevation } from '@epd/domain/types';
import { useResolvedTheme, type ResolvedTheme } from '@/lib/theme/resolvedTheme';

const css = (name: string) =>
  typeof document === 'undefined'
    ? 'black'
    : getComputedStyle(document.documentElement).getPropertyValue(name).trim() || 'black';

export interface CanvasColors {
  background: string;
  grid: string;
  wall: string;
  wallFill: string;
  node: string;
  label: string;
  selection: string;
  highlight: string;
  warning: string;
  riser: string;
  /** One color for every conduit run; the laying type is told apart by `runDash`. */
  run: string;
}

/** Dash pattern (screen px) per laying type: floor dashed, ceiling dash-dot, direct dotted. */
export const runDash: Record<RunElevation, readonly number[]> = {
  floor: [6, 4],
  ceiling: [8, 3, 2, 3],
  direct: [2, 3],
};

/** Reads the canvas tokens from the document's current theme. */
export function readCanvasColors(_theme?: ResolvedTheme): CanvasColors {
  return {
    background: css('--color-canvas-bg'),
    grid: css('--color-canvas-grid'),
    wall: css('--color-canvas-wall'),
    wallFill: css('--color-canvas-wall-fill'),
    node: css('--color-canvas-node'),
    label: css('--color-canvas-label'),
    selection: css('--color-canvas-selection'),
    highlight: css('--color-canvas-highlight'),
    warning: css('--color-canvas-warning'),
    riser: css('--color-canvas-riser'),
    run: css('--color-canvas-run'),
  };
}

/** Canvas colors from the design tokens, read again whenever the resolved theme changes. */
export function useCanvasColors(): CanvasColors {
  const theme = useResolvedTheme();
  // `theme` is not read inside: it only tells when the tokens may have changed.
  return useMemo(() => readCanvasColors(theme), [theme]);
}

/**
 * True once the document's fonts have loaded. Konva measures text when it is created, so layers
 * with text are keyed on this to redraw with the real font metrics instead of the fallback's.
 */
export function useFontsReady(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let live = true;
    void document.fonts?.ready.then(() => {
      if (live) setReady(true);
    });
    return () => {
      live = false;
    };
  }, []);
  return ready;
}
