import { useMemo } from 'react';
import type { RunElevation } from '@epd/domain/types';

const css = (name: string) =>
  typeof document === 'undefined'
    ? '#000'
    : getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#000';

export interface CanvasColors {
  background: string;
  grid: string;
  wall: string;
  node: string;
  selection: string;
  highlight: string;
  riser: string;
  run: Record<RunElevation, string>;
}

/** Canvas colors from the design tokens (CSS custom properties), read once per mount. */
export function useCanvasColors(): CanvasColors {
  return useMemo(
    () => ({
      background: css('--color-canvas-bg'),
      grid: css('--color-canvas-grid'),
      wall: css('--color-canvas-wall'),
      node: css('--color-canvas-node'),
      selection: css('--color-canvas-selection'),
      highlight: css('--color-canvas-highlight'),
      riser: css('--color-canvas-riser'),
      run: {
        floor: css('--color-canvas-run-floor'),
        ceiling: css('--color-canvas-run-ceiling'),
        direct: css('--color-canvas-run-direct'),
      },
    }),
    [],
  );
}
