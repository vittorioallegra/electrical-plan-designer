import { describe, expect, it } from 'vitest';
import { createCatalogLookup } from './catalog/lookup';
import { runChecks, type CheckId } from './checks';
import { bundleDiameter, conduitTooSmall } from './conduitFill';
import { defaultProjectSettings } from './defaults';
import { ac4Doc, circuit, node, seg } from './testing/builders';
import type { ProjectDoc } from './types';

const settings = defaultProjectSettings();
const catalog = createCatalogLookup();
const ids = (d: ProjectDoc) => runChecks(d, settings, catalog).map((w) => w.id);

function withChange(change: (d: ProjectDoc) => void): ProjectDoc {
  const d = ac4Doc();
  change(d);
  return d;
}

describe('checks', () => {
  // protects=AC 13 clean fixture; fails_when=the reference project raises any warning; no_claim=electrical compliance
  it('the AC 4 reference project is clean', () => {
    expect(runChecks(ac4Doc(), settings, catalog)).toEqual([]);
  });

  // protects=AC 13 one triggering fixture per check; fails_when=a check misses its fixture; no_claim=message wording
  it.each<[number, CheckId, (d: ProjectDoc) => void]>([
    [1, 'section_type', (d) => (d.circuits[0]!.crossSection = 1.5)],
    [2, 'rating_section', (d) => (d.panels[0]!.devices[1]!.itemId = 'builtin:mcb_1pn_c20')],
    [3, 'no_rcd', (d) => delete d.panels[0]!.devices[1]!.upstreamDeviceId],
    [4, 'box_not_reached', (d) => (d.circuits = [])],
    [5, 'not_connected', (d) => d.nodes.push(node('X', 'f0', 'junction_box', 9, 9))],
    [
      6,
      'conduit_fill',
      (d) => {
        d.segments[0]!.conduitItemId = 'builtin:conduit_16';
        addCircuits(d, 2);
      },
    ],
    [7, 'box_modules', (d) => d.nodes[2]!.contents!.push({ itemId: 'builtin:switch', qty: 1 })],
    [8, 'panel_capacity', (d) => (d.panels[0]!.devices[2]!.slot = 2)],
    [
      9,
      'box_empty',
      (d) => (d.nodes[2]!.contents = [{ itemId: 'builtin:blanking_cover', qty: 3 }]),
    ],
  ])('check %i (%s) triggers', (_n, id, change) => {
    expect(ids(withChange(change))).toContain(id);
  });

  // protects=check 3 accepts RCBOs; fails_when=an RCBO-protected circuit is flagged; no_claim=—
  it('check 3 accepts an RCBO as protecting device', () => {
    const d = withChange((x) => {
      x.panels[0]!.devices.push({
        id: 'rcbo',
        itemId: 'builtin:rcbo_1pn_c16_30ma_a',
        rail: 0,
        slot: 6,
        label: 'R',
      });
      x.circuits[0]!.panelDeviceId = 'rcbo';
    });
    expect(ids(d)).not.toContain('no_rcd');
  });

  // protects=AC 8 provision exemption; fails_when=a provision box raises "not reached" or "empty"; no_claim=—
  it('provision boxes are exempt from checks 4 and 9', () => {
    const d = withChange((x) => {
      x.nodes.push(
        node('V', 'f0', 'terminal_box', 5, 6, {
          status: 'provision',
          boxItemId: 'builtin:box_503',
        }),
      );
      x.segments.push(seg('S3', 'S', 'V'));
    });
    expect(runChecks(d, settings, catalog)).toEqual([]);
  });

  // protects=check 8 overflow; fails_when=a device past the last rail passes; no_claim=—
  it('check 8 flags devices beyond the rails and the rail end', () => {
    const d = withChange((x) => {
      x.panels[0]!.devices[1]!.rail = 1;
      x.panels[0]!.devices[2]!.slot = 12;
    });
    const w = runChecks(d, settings, catalog).filter((x) => x.id === 'panel_capacity');
    expect(w.map((x) => x.params.reason)).toEqual(['overflow', 'overflow']);
  });

  // protects=AC 12 adding rails fixes capacity; fails_when=a second rail is not honored; no_claim=UI
  it('check 8 passes once the panel has a second rail', () => {
    const d = withChange((x) => {
      x.panels[0]!.dinRails = 2;
      x.panels[0]!.devices[1]!.rail = 1;
    });
    expect(ids(d)).not.toContain('panel_capacity');
  });

  // protects=data-quality warnings; fails_when=a missing catalog item or invalid manual route is silent; no_claim=—
  it('flags missing catalog items and invalid manual routes', () => {
    const d = withChange((x) => {
      x.nodes[2]!.contents!.push({ itemId: 'user:gone', qty: 1 });
      x.circuits[0]!.routing = { mode: 'manual', segmentIds: ['S2'] };
    });
    expect(ids(d)).toEqual(expect.arrayContaining(['missing_item', 'route_invalid']));
  });
});

function addCircuits(d: ProjectDoc, n: number): void {
  for (let i = 0; i < n; i++) d.circuits.push(circuit(`extra${i}`, 'mcb16', ['S']));
}

describe('conduit fill', () => {
  // protects=packing table; fails_when=the bundle Ø for known n is wrong; no_claim=real-world fill
  it('uses the packing table for equal circles', () => {
    expect(bundleDiameter([3])).toBe(3);
    expect(bundleDiameter([3, 3, 3])).toBeCloseTo(6.464, 3);
    expect(bundleDiameter(Array(7).fill(2))).toBe(6);
  });

  // protects=large and mixed bundles; fails_when=the approximation is below the largest Ø scale; no_claim=exact packing
  it('approximates above 20 and uses the largest Ø for mixed sizes', () => {
    expect(bundleDiameter(Array(30).fill(1))).toBeCloseTo(Math.sqrt(30 / 0.77), 6);
    expect(bundleDiameter([3, 3.6])).toBe(7.2);
  });

  // protects=fill rule; fails_when=inner Ø ≥ factor × bundle is flagged; no_claim=—
  it('flags only when inner Ø < factor × bundle Ø', () => {
    expect(conduitTooSmall(14.1, 10, 1.3)).toBe(false);
    expect(conduitTooSmall(12.9, 10, 1.3)).toBe(true);
    expect(conduitTooSmall(10, 0, 1.3)).toBe(false);
  });
});
