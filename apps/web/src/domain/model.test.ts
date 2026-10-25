import { describe, expect, it } from 'vitest';
import demo from '../../../../tests/fixtures/demo-project.json';
import { builtinById, builtinCatalog } from './catalog/builtin';
import { defaultProjectSettings, defaultQuoteSettings, newProjectDoc } from './defaults';
import { DocLoadError, loadDoc, migrateDoc } from './load';
import { CURRENT_SCHEMA_VERSION, projectDocSchema } from './schema';
import type { ProjectDoc } from './types';

const clone = <T>(v: T): T => structuredClone(v);
const demoDoc = demo as ProjectDoc;

function expectInvalid(doc: unknown, message: string) {
  expect(() => loadDoc(doc)).toThrow(DocLoadError);
  try {
    loadDoc(doc);
  } catch (e) {
    expect((e as DocLoadError).issues.map((i) => i.message)).toContain(message);
  }
}

describe('defaults', () => {
  // protects=spec defaults; fails_when=a default drifts from the spec; no_claim=UI shows them
  it('match the spec', () => {
    expect(defaultProjectSettings()).toEqual({
      mountingHeights: { socket: 0.3, switch: 1.1, junctionBox: 0.25, panel: 1.5 },
      defaultFloorHeight: 2.7,
      defaultRunElevation: 'floor',
      terminationSlack: 0.2,
      wastePercent: 10,
      conduitFillFactor: 1.3,
    });
    expect(defaultQuoteSettings()).toEqual({
      materialAdjustmentPercent: 0,
      vatPercent: 22,
      laborLines: [],
    });
  });

  // protects=settings isolation (AC 11); fails_when=two projects share one settings object; no_claim=persistence
  it('returns a fresh settings object per project', () => {
    const a = defaultProjectSettings();
    const b = defaultProjectSettings();
    a.mountingHeights.socket = 0.4;
    expect(b.mountingHeights.socket).toBe(0.3);
  });

  // protects=new project shape; fails_when=a new project has no floor or the wrong height; no_claim=names are translated
  it('creates a new doc with one floor at the default height', () => {
    let n = 0;
    const doc = newProjectDoc('Floor 1', defaultProjectSettings(), () => `id${n++}`);
    expect(doc.floors).toEqual([{ id: 'id0', name: 'Floor 1', order: 0, height: 2.7, walls: [] }]);
    expect(projectDocSchema.safeParse(doc).success).toBe(true);
  });
});

describe('schema', () => {
  // protects=doc round-trip; fails_when=valid fields are dropped or altered on load; no_claim=semantic validity
  it('round-trips the demo fixture unchanged', () => {
    const { doc, readOnly } = loadDoc(clone(demo));
    expect(doc).toEqual(demo);
    expect(readOnly).toBe(false);
    expect(JSON.parse(JSON.stringify(doc))).toEqual(demo);
  });

  // protects=fixture references; fails_when=the fixture uses ids missing from the built-in catalog; no_claim=BOM content
  it('demo fixture references only built-in items', () => {
    const ids = [
      ...demoDoc.nodes.flatMap((n) => [n.boxItemId, ...(n.contents ?? []).map((c) => c.itemId)]),
      ...demoDoc.segments.map((s) => s.conduitItemId),
      ...demoDoc.panels.flatMap((p) => [p.enclosureItemId, ...p.devices.map((d) => d.itemId)]),
    ].filter((x): x is string => x !== undefined);
    expect(ids.filter((id) => !builtinById.has(id))).toEqual([]);
  });

  // protects=structural guard; fails_when=a self-loop segment loads; no_claim=UI prevents drawing it
  it('rejects a segment from a node to itself', () => {
    const doc = clone(demoDoc);
    doc.segments[0]!.toNodeId = doc.segments[0]!.fromNodeId;
    expectInvalid(doc, 'segment from a node to itself');
  });

  // protects=riser guard; fails_when=a normal segment spans floors; no_claim=riser auto-creation
  it('rejects a non-riser segment between floors', () => {
    const doc = clone(demoDoc);
    doc.segments.push({ ...doc.segments[0]!, id: 'bad', toNodeId: 'n_jb2' });
    expectInvalid(doc, 'non-riser segment between floors');
  });

  // protects=extra run guard; fails_when=an extra run from a node to itself loads; no_claim=—
  it('rejects an extra run from a node to itself', () => {
    const doc = clone(demoDoc);
    doc.extraRuns[0]!.toNodeId = doc.extraRuns[0]!.fromNodeId;
    expectInvalid(doc, 'extra run from a node to itself');
  });

  // protects=upstream walk termination; fails_when=an upstream cycle loads (checks would hang); no_claim=command rejection
  it('rejects an upstream cycle', () => {
    const doc = clone(demoDoc);
    doc.panels[0]!.devices[0]!.upstreamDeviceId = 'd_mcb1';
    expectInvalid(doc, 'upstream cycle');
  });

  // protects=id uniqueness; fails_when=two nodes share an id; no_claim=—
  it('rejects duplicate ids', () => {
    const doc = clone(demoDoc);
    doc.nodes.push(clone(doc.nodes[0]!));
    expectInvalid(doc, 'duplicate id n_panel');
  });

  // protects=recovery screen data; fails_when=a broken doc loads or errors lack a path; no_claim=screen rendering
  it('reports the failing path for an invalid doc', () => {
    const doc = clone(demoDoc) as unknown as { nodes: { position: unknown }[] };
    doc.nodes[0]!.position = 'here';
    try {
      loadDoc(doc);
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(DocLoadError);
      expect((e as DocLoadError).code).toBe('invalid_doc');
      expect((e as DocLoadError).issues[0]!.path).toBe('nodes.0.position');
    }
  });
});

describe('schema versions', () => {
  // protects=old tabs never overwrite newer docs; fails_when=a newer schemaVersion opens editable; no_claim=save blocking itself
  it('opens a newer schemaVersion read-only', () => {
    const doc = { ...clone(demoDoc), schemaVersion: CURRENT_SCHEMA_VERSION + 1 };
    expect(loadDoc(doc).readOnly).toBe(true);
  });

  // protects=migration pipeline; fails_when=a current doc is altered or a bad version accepted; no_claim=future migrations
  it('migrateDoc is the identity for v1 and rejects bad versions', () => {
    const doc = clone(demoDoc) as unknown as Record<string, unknown>;
    expect(migrateDoc(doc)).toEqual(demo);
    expect(() => migrateDoc({ ...doc, schemaVersion: 0 })).toThrow(DocLoadError);
    expect(() => migrateDoc({ ...doc, schemaVersion: 'x' })).toThrow(DocLoadError);
  });
});

describe('built-in catalog', () => {
  // protects=stable catalog keys; fails_when=two built-ins share an id; no_claim=names are unique
  it('has unique builtin: ids', () => {
    const ids = builtinCatalog.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => id.startsWith('builtin:'))).toBe(true);
  });

  // protects=conduit fill inputs; fails_when=a conduit lacks diameters or a cable lacks outer Ø; no_claim=values are exact
  it('gives every conduit inner/outer Ø and every cable section + outer Ø', () => {
    for (const item of builtinCatalog) {
      if (item.category === 'conduit') {
        expect(item.attributes.innerDiameter).toBeLessThan(item.attributes.outerDiameter!);
      }
      if (item.category === 'cable') {
        expect(item.attributes.crossSection).toBeGreaterThan(0);
        expect(item.attributes.outerDiameter).toBeGreaterThan(0);
      }
      if (
        item.category === 'panel_device' ||
        item.category === 'plate' ||
        item.category === 'box'
      ) {
        expect(item.modules).toBeGreaterThan(0);
      }
    }
  });
});
