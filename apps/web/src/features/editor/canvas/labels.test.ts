import { describe, expect, it } from 'vitest';
import { nodeLabelBox, segmentLabelBox } from './labels';

describe('canvas labels', () => {
  // protects=node labels stay clear of their conduits; fails_when=a label is drawn on the side a conduit leaves from; no_claim=collisions with other nodes' labels
  it('puts a node label on the side away from its conduits', () => {
    expect(nodeLabelBox([]).align).toBe('left'); // right of the node by default
    expect(nodeLabelBox([{ x: 1, y: 0 }]).align).toBe('right'); // conduit to the right → label left
    // Conduits right and down (a corner like Q1 or a switch): label on the left.
    expect(
      nodeLabelBox([
        { x: 2, y: 0 },
        { x: 0, y: 3 },
      ]).align,
    ).toBe('right');
    // Conduits right and up: label below.
    const box = nodeLabelBox([
      { x: 1, y: 0 },
      { x: 0, y: -1 },
    ]);
    expect(box.align).toBe('center');
    expect(box.y).toBeGreaterThan(0);
    // Conduits left and right: label below, not on top of either.
    expect(
      nodeLabelBox([
        { x: -1, y: 0 },
        { x: 1, y: 0 },
      ]).y,
    ).toBeGreaterThan(0);
  });

  // protects=length labels beside their segment; fails_when=a length label sits on the conduit line; no_claim=—
  it('puts length labels above horizontal and beside vertical segments', () => {
    const horizontal = segmentLabelBox({ x: 0, y: 0 }, { x: 5, y: 0.5 });
    expect(horizontal.y + 11).toBeLessThan(0);
    const vertical = segmentLabelBox({ x: 0, y: 0 }, { x: 0.2, y: 4 });
    expect(vertical.x).toBeGreaterThan(0);
    expect(vertical.align).toBe('left');
  });
});
