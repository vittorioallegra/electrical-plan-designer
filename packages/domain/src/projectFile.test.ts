import { describe, expect, it } from 'vitest';
import v1 from './projectFile/fixtures/v1.json';
import {
  loadProjectFile,
  newProjectFile,
  PROJECT_FILE_SCHEMA_VERSION,
  ProjectFileError,
  referencedAssetIds,
  serializeProjectFile,
  type ProjectFile,
} from './projectFile';
import { defaultLibraryCore } from './library';
import { CURRENT_SCHEMA_VERSION } from './schema';

const now = new Date('2026-10-26T10:00:00.000Z');

function fixture(): { manifest: Record<string, unknown>; project: Record<string, unknown> } {
  return structuredClone(v1) as never;
}

function loaded(): ProjectFile {
  const { manifest, project } = fixture();
  return loadProjectFile(manifest, project);
}

function codeOf(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (e) {
    return e instanceof ProjectFileError ? e.code : `other: ${String(e)}`;
  }
  return undefined;
}

describe('project file', () => {
  // protects=old files always open (frozen v1 fixture); fails_when=a schema change breaks loading a v1 file without a migration; no_claim=zip layout
  it('loads the frozen v1 fixture', () => {
    const file = loaded();
    expect(file.meta.name).toBe('Fixture house');
    expect(file.items.map((i) => i.id)).toEqual(['builtin:conduit_20', 'cat1:BR-1']);
    expect(file.cablePrices['cable:2.5:brown']).toEqual({ unitPrice: 55, code: 'C25M' });
    expect(file.quote.issued[0]).toMatchObject({ number: 1, status: 'approved', note: 'Signed' });
    expect(file.doc.nodes.length).toBeGreaterThan(0);
  });

  // protects=save then open gives the same project; fails_when=serialize drops or alters a field; no_claim=asset bytes
  it('round-trips through serialize and load', () => {
    const file = loaded();
    const { manifest, project } = serializeProjectFile(file, '9.9.9', now);
    expect(manifest).toEqual({
      format: 'epd',
      schemaVersion: PROJECT_FILE_SCHEMA_VERSION,
      appVersion: '9.9.9',
      savedAt: now.toISOString(),
    });
    expect(project).not.toBe(file);
    expect(
      loadProjectFile(JSON.parse(JSON.stringify(manifest)), JSON.parse(JSON.stringify(project))),
    ).toEqual(file);
  });

  // protects=files from a newer app are refused; fails_when=a newer manifest or doc version loads or fails with another code; no_claim=message wording
  it('refuses files from a newer version', () => {
    const a = fixture();
    a.manifest.schemaVersion = PROJECT_FILE_SCHEMA_VERSION + 1;
    expect(codeOf(() => loadProjectFile(a.manifest, a.project))).toBe('newer_version');
    const b = fixture();
    (b.project.doc as Record<string, unknown>).schemaVersion = CURRENT_SCHEMA_VERSION + 1;
    expect(codeOf(() => loadProjectFile(b.manifest, b.project))).toBe('newer_version');
  });

  // protects=clear errors for non-project and broken files; fails_when=junk loads or throws a non-ProjectFileError; no_claim=which issue is reported first
  it('rejects files that are not valid projects', () => {
    const { manifest, project } = fixture();
    expect(codeOf(() => loadProjectFile(null, project))).toBe('not_a_project');
    expect(codeOf(() => loadProjectFile({ ...manifest, format: 'zip' }, project))).toBe(
      'not_a_project',
    );
    expect(codeOf(() => loadProjectFile({ ...manifest, schemaVersion: 0 }, project))).toBe(
      'invalid',
    );
    expect(codeOf(() => loadProjectFile(manifest, []))).toBe('invalid');
    expect(codeOf(() => loadProjectFile(manifest, { ...project, settings: {} }))).toBe('invalid');
  });

  // protects=a project saved in the previous shape still opens; fails_when=embedded company, catalogs, overrides or presets make loading fail or leak into the project, or items are rebuilt from them; no_claim=the web build's file reading
  it('opens a file in the previous shape, ignoring its company, catalogs, prices and presets', () => {
    const { manifest, project } = fixture();
    delete project.items;
    delete project.cablePrices;
    Object.assign(project, {
      company: { businessName: 'Old', vatNumber: '', address: '', phone: '', email: '' },
      catalogs: [{ id: 'c1', name: 'Old', importedAt: '2026-10-01', items: [] }],
      priceOverrides: { 'builtin:box_503': { unitPrice: 1 } },
      boxPresets: [{ id: 'p', name: 'P', contents: [] }],
    });
    const file = loadProjectFile(manifest, project);
    expect(file.items).toEqual([]);
    expect(file.cablePrices).toEqual({});
    expect(Object.keys(file).sort()).toEqual(
      ['cablePrices', 'doc', 'items', 'meta', 'quote', 'settings'].sort(),
    );
  });

  // protects=file-level integrity; fails_when=duplicate item copies, two approved quotes or a broken doc load; no_claim=asset references
  it('rejects integrity problems', () => {
    const cases: ((p: ProjectFile) => void)[] = [
      (p) => p.items.push(structuredClone(p.items[0]!)),
      (p) => (p.items[1]!.id = p.items[0]!.id),
      (p) => p.quote.issued.push({ ...structuredClone(p.quote.issued[0]!), number: 2 }),
      (p) => p.quote.issued.push({ ...structuredClone(p.quote.issued[0]!), status: 'issued' }),
      (p) => (p.doc.segments[0]!.fromNodeId = 'nope'),
    ];
    for (const change of cases) {
      const file = loaded();
      change(file);
      const { manifest, project } = serializeProjectFile(file, '0.1.0', now);
      expect(codeOf(() => loadProjectFile(manifest, project))).toBe('invalid');
    }
  });
});

describe('assets', () => {
  // protects=which assets a save keeps; fails_when=a background is missed, or a floor without one adds one; no_claim=asset bytes
  it('lists the assets a project references', () => {
    const file = loaded();
    expect(referencedAssetIds(file)).toEqual(new Set());
    file.doc.floors[0]!.background = {
      assetId: 'bg1',
      kind: 'image',
      widthPx: 10,
      heightPx: 10,
      offset: { x: 0, y: 0 },
      rotation: 0,
      opacity: 1,
    };
    expect(referencedAssetIds(file)).toEqual(new Set(['bg1']));
  });
});

describe('new projects', () => {
  // protects=a new project starts from the library defaults; fails_when=the new file does not validate, carries items or quotes, misses the defaults or shares them with the library; no_claim=i18n of the floor name
  it('creates a valid empty project from the library defaults', () => {
    let n = 0;
    const defaults = defaultLibraryCore().defaults;
    defaults.settings.wastePercent = 15;
    defaults.quote.vatPercent = 10;
    defaults.quote.laborLines = [{ kind: 'lump', description: 'Setup', amount: 100 }];
    const file = newProjectFile(
      { name: 'A', firstFloorName: 'Ground' },
      defaults,
      now,
      () => `g${++n}`,
    );
    expect(file.meta).toEqual({
      name: 'A',
      clientName: '',
      address: '',
      createdAt: now.toISOString(),
    });
    expect(file.doc.floors).toEqual([expect.objectContaining({ id: 'g1', name: 'Ground' })]);
    expect(file.settings).toEqual(defaults.settings);
    expect(file.quote).toEqual({ settings: defaults.quote, issued: [] });
    expect(file.items).toEqual([]);
    expect(file.cablePrices).toEqual({});
    file.settings.wastePercent = 20;
    file.quote.settings.laborLines.pop();
    expect(defaults.settings.wastePercent).toBe(15);
    expect(defaults.quote.laborLines).toHaveLength(1);
    const { manifest, project } = serializeProjectFile(file, '0.1.0', now);
    expect(loadProjectFile(manifest, project)).toEqual(file);
  });

  // protects=a saved .epd holds no business data; fails_when=a serialized project carries company, logo, catalogs, overrides or presets; no_claim=zip layout
  it('serializes without company, catalogs, prices or presets', () => {
    const file = newProjectFile(
      { name: 'A', firstFloorName: 'Ground' },
      defaultLibraryCore().defaults,
      now,
    );
    const { project } = serializeProjectFile(file, '0.1.0', now);
    expect(Object.keys(project).sort()).toEqual(
      ['cablePrices', 'doc', 'items', 'meta', 'quote', 'settings'].sort(),
    );
  });
});
