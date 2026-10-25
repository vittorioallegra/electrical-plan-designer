import { describe, expect, it } from 'vitest';
import demo from '../../../../../../tests/fixtures/demo-project.json';
import type { ProjectDoc } from '@epd/domain/types';
import { boxSelect, hitTest } from './hitTest';

const doc = demo as ProjectDoc;

describe('hitTest', () => {
  // protects=selection priority; fails_when=a segment wins over the node at its end; no_claim=pixel-perfect shapes
  it('lists the node first, then segments ending there', () => {
    const hits = hitTest(doc, 'f0', { x: 5.05, y: 0 }, 100);
    expect(hits.map((h) => h.id)).toEqual(['n_jb1', 's01', 's02']);
  });

  // protects=Tab cycling input; fails_when=overlapping walls and segments are not all listed; no_claim=—
  it('hits segments and walls along their length', () => {
    expect(hitTest(doc, 'f0', { x: 2.5, y: 0.03 }, 100).map((h) => h.id)).toEqual(['s01']);
    expect(hitTest(doc, 'f0', { x: 3, y: -1 }, 100).map((h) => h.kind)).toEqual(['wall']);
    expect(hitTest(doc, 'f1', { x: 2.5, y: 0.03 }, 100)).toEqual([]);
  });

  // protects=box select; fails_when=partially covered segments are selected; no_claim=—
  it('box-selects elements fully inside', () => {
    expect(boxSelect(doc, 'f0', { x: 4, y: -0.5 }, { x: 6, y: 3.5 })).toEqual([
      'n_jb1',
      'n_s1',
      's02',
    ]);
  });
});
