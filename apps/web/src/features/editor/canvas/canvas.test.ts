import { describe, expect, it } from 'vitest';
import { backgroundToWorld, worldToBackground } from '@epd/domain/geometry';
import type { Background } from '@epd/domain/types';
import { snapPoint } from './snapping';
import { centerOn, fitView, gridStep, screenToWorld, worldToScreen, zoomAt } from './viewport';

describe('viewport', () => {
  // protects=screen/world mapping; fails_when=a round trip drifts; no_claim=Konva rendering
  it('round-trips screen and world coordinates', () => {
    const view = { scale: 37, x: 12, y: -40 };
    const p = { x: 3.21, y: -1.5 };
    const back = screenToWorld(view, worldToScreen(view, p));
    expect(back.x).toBeCloseTo(p.x, 10);
    expect(back.y).toBeCloseTo(p.y, 10);
  });

  // protects=zoom at cursor; fails_when=the point under the cursor moves while zooming; no_claim=—
  it('zooms keeping the anchor fixed', () => {
    const view = { scale: 50, x: 10, y: 10 };
    const anchor = { x: 300, y: 200 };
    const before = screenToWorld(view, anchor);
    const after = screenToWorld(zoomAt(view, anchor, 1.7), anchor);
    expect(after.x).toBeCloseTo(before.x, 10);
    expect(after.y).toBeCloseTo(before.y, 10);
  });

  // protects=warning focus panning; fails_when=the focused point is not centered or the zoom changes; no_claim=—
  it('centers a world point without zooming', () => {
    const view = centerOn({ scale: 40, x: 0, y: 0 }, { x: 5, y: 2 }, { width: 800, height: 600 });
    expect(view.scale).toBe(40);
    expect(worldToScreen(view, { x: 5, y: 2 })).toEqual({ x: 400, y: 300 });
  });

  // protects=fit to content; fails_when=the box is not fully visible; no_claim=—
  it('fits a box into the screen', () => {
    const view = fitView({ minX: 0, minY: 0, maxX: 10, maxY: 5 }, { width: 1000, height: 600 });
    const tl = worldToScreen(view, { x: 0, y: 0 });
    const br = worldToScreen(view, { x: 10, y: 5 });
    expect(tl.x).toBeGreaterThanOrEqual(39);
    expect(br.x).toBeLessThanOrEqual(961);
    expect(br.y).toBeLessThanOrEqual(561);
  });

  // protects=readable grid; fails_when=grid lines get closer than 12 px; no_claim=—
  it('picks a grid step at least 12 px apart', () => {
    expect(gridStep(200)).toBe(0.1);
    expect(gridStep(50)).toBe(0.5);
    expect(gridStep(5)).toBe(5);
  });
});

describe('snapping', () => {
  const targets = {
    nodes: [{ id: 'n', position: { x: 1, y: 1 } }],
    vertices: [{ x: 1.05, y: 1.05 }],
    wallEnds: [{ x: 3, y: 3 }],
  };
  const opts = { scale: 100, gridStep: 0.5, enabled: true };

  // protects=snap priority; fails_when=a vertex wins over a node within tolerance; no_claim=—
  it('prefers nodes, then vertices, then wall ends, then grid', () => {
    expect(snapPoint({ x: 1.04, y: 1.04 }, targets, opts)).toMatchObject({
      kind: 'node',
      nodeId: 'n',
    });
    expect(snapPoint({ x: 1.1, y: 1.1 }, { ...targets, nodes: [] }, opts).kind).toBe('vertex');
    expect(snapPoint({ x: 3.05, y: 2.97 }, targets, opts)).toEqual({
      point: { x: 3, y: 3 },
      kind: 'wall',
    });
    expect(snapPoint({ x: 2.2, y: 0.7 }, targets, opts)).toEqual({
      point: { x: 2, y: 0.5 },
      kind: 'grid',
    });
  });

  // protects=Alt disables snapping; fails_when=a disabled snap still moves the point; no_claim=—
  it('returns the raw point when disabled', () => {
    expect(snapPoint({ x: 1.01, y: 1 }, targets, { ...opts, enabled: false })).toEqual({
      point: { x: 1.01, y: 1 },
      kind: 'none',
    });
  });
});

describe('background transform', () => {
  // protects=calibration clicks; fails_when=world→background is not the inverse; no_claim=—
  it('worldToBackground inverts backgroundToWorld', () => {
    const bg: Background = {
      storagePath: 'x',
      kind: 'image',
      widthPx: 1000,
      heightPx: 800,
      calibration: { p1: { x: 0, y: 0 }, p2: { x: 420, y: 0 }, realDistance: 4.2 },
      offset: { x: 2, y: -1 },
      rotation: 30,
      opacity: 0.4,
    };
    const px = { x: 123, y: 456 };
    const back = worldToBackground(bg, backgroundToWorld(bg, px)!)!;
    expect(back.x).toBeCloseTo(123, 8);
    expect(back.y).toBeCloseTo(456, 8);
  });
});
