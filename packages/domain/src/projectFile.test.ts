import { describe, expect, it } from 'vitest';
import v1 from './projectFile/fixtures/v1.json';
import {
  loadProjectFile,
  newProjectFile,
  PROJECT_FILE_SCHEMA_VERSION,
  ProjectFileError,
  projectFileFromTemplate,
  referencedAssetIds,
  serializeProjectFile,
  type ProjectFile,
} from './projectFile';
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
    expect(file.catalogs[0]!.items).toHaveLength(2);
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

  // protects=file-level integrity; fails_when=duplicate catalogs, foreign item ids, two approved quotes or a broken doc load; no_claim=asset references
  it('rejects integrity problems', () => {
    const cases: ((p: ProjectFile) => void)[] = [
      (p) => p.catalogs.push(structuredClone(p.catalogs[0]!)),
      (p) => (p.catalogs[0]!.items[0]!.id = 'other:BR-1'),
      (p) => (p.catalogs[0]!.items[1]!.id = p.catalogs[0]!.items[0]!.id),
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

  // protects=quotes stored before statuses existed; fails_when=a snapshot without status or note fails to load; no_claim=Supabase rows
  it('defaults a missing quote status and note', () => {
    const { manifest, project } = fixture();
    const issued = (project.quote as { issued: Record<string, unknown>[] }).issued[0]!;
    delete issued.status;
    delete issued.note;
    delete issued.statusChangedAt;
    expect(loadProjectFile(manifest, project).quote.issued[0]).toMatchObject({
      status: 'issued',
      note: '',
    });
  });
});

describe('assets', () => {
  // protects=which assets a save keeps; fails_when=a background or the logo is missed, or a floor without background adds one; no_claim=asset bytes
  it('lists the assets a project references', () => {
    const file = loaded();
    expect(referencedAssetIds(file)).toEqual(new Set(['logo1']));
    file.doc.floors[0]!.background = {
      assetId: 'bg1',
      kind: 'image',
      widthPx: 10,
      heightPx: 10,
      offset: { x: 0, y: 0 },
      rotation: 0,
      opacity: 1,
    };
    delete file.company.logoAssetId;
    expect(referencedAssetIds(file)).toEqual(new Set(['bg1']));
  });
});

describe('new projects', () => {
  // protects=a new project starts from defaults; fails_when=the new file does not validate or carries catalogs or quotes; no_claim=i18n of the floor name
  it('creates a valid empty project', () => {
    let n = 0;
    const file = newProjectFile({ name: 'A', firstFloorName: 'Ground' }, now, () => `g${++n}`);
    expect(file.meta).toEqual({
      name: 'A',
      clientName: '',
      address: '',
      createdAt: now.toISOString(),
    });
    expect(file.doc.floors).toEqual([expect.objectContaining({ id: 'g1', name: 'Ground' })]);
    expect(file.catalogs).toEqual([]);
    expect(file.quote.issued).toEqual([]);
    const { manifest, project } = serializeProjectFile(file, '0.1.0', now);
    expect(loadProjectFile(manifest, project)).toEqual(file);
  });

  // protects=AC 14 template copy; fails_when=the drawing, labor lines or quotes are copied, or settings, company, catalogs, overrides, presets are not; no_claim=asset copying
  it('copies business data, not the drawing or quotes, from a template', () => {
    const template = loaded();
    template.settings.wastePercent = 15;
    template.quote.settings.vatPercent = 10;
    template.quote.settings.laborLines = [{ kind: 'lump', description: 'x', amount: 1 }];
    const file = projectFileFromTemplate(template, { name: 'B', firstFloorName: 'Ground' }, now);
    expect(file.meta.name).toBe('B');
    expect(file.settings).toEqual(template.settings);
    expect(file.company).toEqual(template.company);
    expect(file.catalogs).toEqual(template.catalogs);
    expect(file.priceOverrides).toEqual(template.priceOverrides);
    expect(file.boxPresets).toEqual(template.boxPresets);
    expect(file.quote).toEqual({
      settings: { ...template.quote.settings, laborLines: [] },
      issued: [],
    });
    expect(file.doc.nodes).toEqual([]);
    expect(file.doc.floors).toHaveLength(1);
    file.catalogs[0]!.name = 'changed';
    expect(template.catalogs[0]!.name).toBe('Brand 2026');
  });
});
