import { describe, expect, it } from 'vitest';
import demo from '../../../../tests/fixtures/demo-project.json';
import { defaultProjectSettings } from './defaults';
import {
  backgroundToWorld,
  ceilClean,
  distance,
  metersPerPixel,
  polylineLength,
  toMm,
} from './geometry';
import { createLengthContext, segmentLengths } from './lengths';
import { ac4Doc, doc, floor, node, seg } from './testing/builders';
import type { Background, ProjectDoc, RunElevation } from './types';

const settings = defaultProjectSettings();

describe('geometry', () => {
  // protects=plan lengths; fails_when=polyline length ignores a vertex; no_claim=—
  it('measures polylines', () => {
    expect(
      polylineLength([
        { x: 0, y: 0 },
        { x: 3, y: 0 },
        { x: 3, y: 4 },
      ]),
    ).toBe(7);
  });

  // protects=AC 2 calibration; fails_when=a calibrated 4.20 m distance measures off by > 1 cm; no_claim=UI clicks
  it('maps a calibrated background so the two points are 4.20 m apart', () => {
    const background: Background = {
      storagePath: 'u/p/bg.png',
      kind: 'image',
      widthPx: 2000,
      heightPx: 1500,
      calibration: { p1: { x: 312.4, y: 801.2 }, p2: { x: 1113.9, y: 655.7 }, realDistance: 4.2 },
      offset: { x: -3, y: 2 },
      rotation: 17,
      opacity: 0.4,
    };
    const a = backgroundToWorld(background, background.calibration!.p1)!;
    const b = backgroundToWorld(background, background.calibration!.p2)!;
    expect(Math.abs(distance(a, b) - 4.2)).toBeLessThan(0.01);
    expect(metersPerPixel({ p1: { x: 0, y: 0 }, p2: { x: 0, y: 0 }, realDistance: 1 })).toBeNull();
  });

  // protects=whole-meter rounding; fails_when=float noise makes 12 m round up to 13 m; no_claim=—
  it('ceilClean ignores float noise', () => {
    expect(ceilClean(12.000000000000002)).toBe(12);
    expect(ceilClean(12.0001)).toBe(13);
    expect(toMm(0.1 + 0.2)).toBe(300);
  });
});

describe('segment lengths', () => {
  // protects=AC 4 lengths; fails_when=S1 ≠ 6.75 m or S2 ≠ 3.55 m with default heights; no_claim=BOM totals
  it('AC 4: floor runs add both end drops', () => {
    const lengths = segmentLengths(ac4Doc(), settings);
    expect(lengths.get('S1')).toBe(6750);
    expect(lengths.get('S2')).toBe(3550);
  });

  // protects=AC 3 walls-only plans; fails_when=a plan with no background loses meter lengths; no_claim=wall drawing
  it('AC 3: measures in meters with walls only', () => {
    const d = ac4Doc();
    d.floors[0]!.walls = [{ id: 'w', a: { x: 0, y: 0 }, b: { x: 5, y: 0 }, thickness: 0.3 }];
    expect(segmentLengths(d, settings).get('S1')).toBe(6750);
  });

  // protects=ceiling runs; fails_when=drops are not measured from the ceiling; no_claim=—
  it('ceiling runs drop from the floor height', () => {
    const d = ac4Doc();
    d.segments[1]!.runElevation = 'ceiling';
    // 3.00 + (2.70 − 0.25) + (2.70 − 0.30)
    expect(segmentLengths(d, settings).get('S2')).toBe(7850);
  });

  // protects=direct runs; fails_when=direct runs add both drops; no_claim=—
  it('direct runs add only the height difference', () => {
    const d = ac4Doc();
    d.segments[0]!.runElevation = 'direct';
    expect(segmentLengths(d, settings).get('S1')).toBe(6250);
  });

  // protects=per-box override and ceiling mounting; fails_when=customHeight or ceiling mounting is ignored; no_claim=—
  it('resolves heights: mounting default, project settings, per-box override, ceiling', () => {
    const d = doc({
      nodes: [
        node('a', 'f0', 'terminal_box', 0, 0, { mounting: 'switch' }),
        node('b', 'f0', 'terminal_box', 1, 0, { mounting: 'switch', customHeight: 0.9 }),
        node('c', 'f0', 'terminal_box', 2, 0, { mounting: 'ceiling' }),
        node('d', 'f0', 'terminal_box', 3, 0, { mounting: 'custom', customHeight: 5 }),
      ],
    });
    const ctx = createLengthContext(d, settings);
    expect(ctx.nodeHeightMm('a')).toBe(1100);
    expect(ctx.nodeHeightMm('b')).toBe(900);
    expect(ctx.nodeHeightMm('c')).toBe(2700);
    expect(ctx.nodeHeightMm('d')).toBe(2700);
    expect(ctx.clampedNodeIds).toEqual(['d']);
  });

  // protects=AC 11 settings isolation; fails_when=project A's settings change project B's lengths; no_claim=storage isolation
  it('AC 11: lengths depend only on the project own settings', () => {
    const a = defaultProjectSettings();
    const b = defaultProjectSettings();
    a.mountingHeights.socket = 0.5;
    expect(segmentLengths(ac4Doc(), a).get('S2')).toBe(3750);
    expect(segmentLengths(ac4Doc(), b).get('S2')).toBe(3550);
  });

  // protects=whole-meter landing; fails_when=an exact 12 m length is stored as 12.000000000000002; no_claim=—
  it('a length landing on a whole meter stays exact', () => {
    const d = doc({
      nodes: [node('P', 'f0', 'panel', 0.1, 0.2), node('J', 'f0', 'junction_box', 10.35, 0.2)],
      segments: [seg('s', 'P', 'J')],
    });
    // 10.25 + 1.50 + 0.25 = 12.00
    expect(segmentLengths(d, settings).get('s')).toBe(12000);
  });
});

describe('risers', () => {
  function twoFloors(lower: RunElevation, upper: RunElevation): ProjectDoc {
    return doc({
      floors: [floor('f0', 0, 2.7), floor('f1', 1, 3.0)],
      nodes: [
        node('J0', 'f0', 'junction_box', 0, 0),
        node('R0', 'f0', 'riser_point', 2, 0, { riserGroupId: 'g' }),
        node('R1', 'f1', 'riser_point', 2, 0, { riserGroupId: 'g' }),
        node('J1', 'f1', 'junction_box', 0, 0),
      ],
      segments: [
        seg('a', 'J0', 'R0', { runElevation: lower }),
        seg('r', 'R0', 'R1'),
        seg('b', 'R1', 'J1', { runElevation: upper }),
      ],
    });
  }

  // protects=AC 10 riser length; fails_when=a floor-to-floor riser ≠ 2.70 m; no_claim=conductor counting
  it('AC 10: floor run below and above gives the floor height', () => {
    const d = twoFloors('floor', 'floor');
    expect(segmentLengths(d, settings).get('r')).toBe(2700);
    // Runs at floor drop 0 into the riser point.
    expect(segmentLengths(d, settings).get('a')).toBe(2000 + 250);
  });

  // protects=no double count; fails_when=a ceiling run below into a floor run above adds a floor height again; no_claim=—
  it('ceiling run below into floor run above gives ≈ 0', () => {
    const lengths = segmentLengths(twoFloors('ceiling', 'floor'), settings);
    expect(lengths.get('r')).toBe(0);
    // the ceiling run itself already climbs: 2.00 + (2.70 − 0.25) + 0
    expect(lengths.get('a')).toBe(4450);
  });

  // protects=riser rule combinations; fails_when=any end-elevation combination is mis-measured; no_claim=—
  it.each([
    ['floor', 'ceiling', 2700 + 3000],
    ['ceiling', 'ceiling', 3000],
  ] as const)('lower %s / upper %s', (lower, upper, expected) => {
    expect(segmentLengths(twoFloors(lower, upper), settings).get('r')).toBe(expected);
  });

  // protects=mixed riser warning input; fails_when=mixed run elevations at a riser go unreported; no_claim=warning text
  it('reports riser points with mixed run elevations', () => {
    const d = twoFloors('floor', 'floor');
    d.nodes.push(node('J2', 'f0', 'junction_box', 4, 0));
    d.segments.push(seg('c', 'R0', 'J2', { runElevation: 'ceiling' }));
    expect(createLengthContext(d, settings).mixedRiserNodeIds).toEqual(['R0']);
  });

  // protects=3-floor chains; fails_when=elevations of upper floors are not cumulative; no_claim=—
  it('3-floor riser chain uses cumulative elevations', () => {
    const lengths = segmentLengths(demo as ProjectDoc, settings);
    expect(lengths.get('s06')).toBe(2700);
    expect(lengths.get('s09')).toBe(2700);
    const ctx = createLengthContext(demo as ProjectDoc, settings);
    expect(ctx.floorElevationMm('f2')).toBe(5400);
  });
});
