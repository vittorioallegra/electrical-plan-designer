import { describe, expect, it } from 'vitest';
import demo from '../../../tests/fixtures/demo-project.json';
import { computeBom, type BomLine } from './bom';
import { createCatalogLookup } from './catalog/lookup';
import { defaultProjectSettings } from './defaults';
import { ac4Doc, node, seg } from './testing/builders';
import type { ProjectDoc } from './types';

const settings = defaultProjectSettings();
const catalog = createCatalogLookup();
const bom = (d: ProjectDoc) => computeBom(d, settings, catalog);
const qty = (lines: BomLine[], key: string) => lines.find((l) => l.key === key)?.quantity;

describe('BOM', () => {
  // protects=AC 4 BOM; fails_when=cable ≠ 13 m per color or conduit ≠ 12 m; no_claim=pricing
  it('AC 4: 13 m of 2.5 mm² per color and 12 m of 20 mm conduit', () => {
    const lines = bom(ac4Doc());
    expect(qty(lines, 'cable:2.5:brown')).toBe(13);
    expect(qty(lines, 'cable:2.5:blue')).toBe(13);
    expect(qty(lines, 'cable:2.5:yellow_green')).toBe(13);
    expect(qty(lines, 'builtin:conduit_20')).toBe(12);
    expect(lines.filter((l) => l.category === 'cable')).toHaveLength(3);
  });

  // protects=box, contents and panel counts; fails_when=a box, device or panel item is missed; no_claim=—
  it('counts boxes, contents, enclosure and panel devices', () => {
    const lines = bom(ac4Doc());
    expect(qty(lines, 'builtin:box_503')).toBe(1);
    expect(qty(lines, 'builtin:junction_box_92x92')).toBe(1);
    expect(qty(lines, 'builtin:socket_10_16')).toBe(1);
    expect(qty(lines, 'builtin:blanking_cover')).toBe(2);
    expect(qty(lines, 'builtin:plate_3m')).toBe(1);
    expect(qty(lines, 'builtin:enclosure_12m')).toBe(1);
    expect(qty(lines, 'builtin:rcd_2p_40a_30ma_a')).toBe(1);
    expect(qty(lines, 'builtin:mcb_1pn_c16')).toBe(1);
  });

  // protects=AC 8 provision boxes; fails_when=a provision box adds cable or loses its conduit/box; no_claim=check 4
  it('AC 8: a provision box adds conduit and box but no cable', () => {
    const d = ac4Doc();
    d.circuits = [];
    d.nodes.push(
      node('V', 'f0', 'terminal_box', 5, 6, { status: 'provision', boxItemId: 'builtin:box_504' }),
    );
    d.segments.push(seg('S3', 'S', 'V'));
    const lines = bom(d);
    expect(lines.filter((l) => l.category === 'cable')).toEqual([]);
    expect(qty(lines, 'builtin:box_504')).toBe(1);
    // S1 6.75 + S2 3.55 + S3 3.00 + 0.30 + 0.30 = 13.90 m × 1.1 = 15.29 → 16
    expect(qty(lines, 'builtin:conduit_20')).toBe(16);
  });

  // protects=AC 9 plate and covers; fails_when=covers or plate are missing from the BOM; no_claim=—
  it('AC 9: plate with 3 blanking covers lists both', () => {
    const d = ac4Doc();
    d.nodes[2]!.contents = [
      { itemId: 'builtin:blanking_cover', qty: 3 },
      { itemId: 'builtin:plate_3m', qty: 1 },
    ];
    const lines = bom(d);
    expect(qty(lines, 'builtin:blanking_cover')).toBe(3);
    expect(qty(lines, 'builtin:plate_3m')).toBe(1);
  });

  // protects=G2 live BOM; fails_when=adding or removing an element leaves totals unchanged; no_claim=UI refresh
  it('updates when elements are added or removed', () => {
    const d = ac4Doc();
    d.nodes.push(node('S2', 'f0', 'terminal_box', 9, 0, { boxItemId: 'builtin:box_503' }));
    d.segments.push(seg('S3', 'JB', 'S2'));
    d.circuits[0]!.targetNodeIds.push('S2');
    expect(qty(bom(d), 'builtin:box_503')).toBe(2);
    expect(qty(bom(d), 'cable:2.5:brown')).toBeGreaterThan(13);
    d.segments = d.segments.filter((s) => s.id !== 'S2');
    expect(qty(bom(d), 'builtin:conduit_20')).toBeLessThan(12 + 5);
    d.nodes = d.nodes.filter((n) => n.id !== 'S2');
    expect(qty(bom(d), 'builtin:box_503')).toBe(1);
  });

  // protects=no silent drops; fails_when=an unknown item id disappears from the BOM; no_claim=warning text
  it('keeps unknown items as missing lines', () => {
    const d = ac4Doc();
    d.nodes[2]!.contents!.push({ itemId: 'user:gone', qty: 2 });
    const line = bom(d).find((l) => l.key === 'user:gone');
    expect(line).toEqual({
      key: 'user:gone',
      category: 'missing',
      itemId: 'user:gone',
      quantity: 2,
      unit: 'pcs',
    });
  });

  // protects=riser cable counting (AC 10); fails_when=riser conductors are not in the BOM; no_claim=—
  it('counts the demo project risers and extra runs', () => {
    const lines = bom(demo as ProjectDoc);
    expect(qty(lines, 'builtin:conduit_25')).toBe(3); // riser 2.70 m × 1.1 = 2.97 → 3
    expect(qty(lines, 'cable:1.5:black')).toBeGreaterThan(0);
  });
});
