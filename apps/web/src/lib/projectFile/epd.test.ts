// @vitest-environment node
import { readFileSync } from 'node:fs';
import { strToU8, unzipSync, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { ProjectFileError, type ProjectFile } from '@epd/domain/projectFile';
import { readEpd, writeEpd, type ProjectAsset } from './epd';

const fixture = (name: string) =>
  new Uint8Array(readFileSync(new URL(`../../../../../tests/fixtures/${name}`, import.meta.url)));
const now = new Date('2026-10-26T12:00:00.000Z');
const options = { appVersion: '0.1.0', now };

function withAssets(project: ProjectFile): ProjectFile {
  const p = structuredClone(project);
  p.doc.floors[0]!.background = {
    assetId: 'bg1',
    kind: 'image',
    widthPx: 1000,
    heightPx: 800,
    offset: { x: 0, y: 0 },
    rotation: 0,
    opacity: 0.4,
  };
  p.company.logoAssetId = 'logo1';
  return p;
}

function codeOf(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (e) {
    return e instanceof ProjectFileError ? e.code : 'other';
  }
  return undefined;
}

describe('.epd files', () => {
  // protects=opening the demo file and saving it back; fails_when=read or write loses or alters any project data; no_claim=File System Access
  it('round-trips the demo project', () => {
    const opened = readEpd(fixture('demo-project.epd'));
    expect(opened.project.meta.name).toBe('Demo house');
    expect(opened.assets.size).toBe(0);
    expect(readEpd(writeEpd(opened.project, opened.assets, options))).toEqual(opened);
  });

  // protects=backgrounds and logo travel inside the file; fails_when=asset bytes or types change, an unreferenced asset is kept, or JSON is not where expected; no_claim=image decoding
  it('stores referenced assets and drops the others', () => {
    const { project } = readEpd(fixture('demo-project.epd'));
    const png: ProjectAsset = { mimeType: 'image/png', bytes: fixture('plan-1000x800.png') };
    const pdf: ProjectAsset = { mimeType: 'application/pdf', bytes: fixture('plan-2-pages.pdf') };
    const assets = new Map([
      ['bg1', png],
      ['logo1', pdf],
      ['unused', png],
    ]);
    const bytes = writeEpd(withAssets(project), assets, options);
    expect(Object.keys(unzipSync(bytes)).sort()).toEqual([
      'assets/bg1.png',
      'assets/logo1.pdf',
      'manifest.json',
      'project.json',
    ]);
    const opened = readEpd(bytes);
    expect(opened.project).toEqual(withAssets(project));
    expect(opened.assets).toEqual(
      new Map([
        ['bg1', png],
        ['logo1', pdf],
      ]),
    );
  });

  // protects=a save never writes a file that cannot be opened; fails_when=a missing or unsafe asset id is written; no_claim=error wording
  it('refuses to write missing assets or unsafe asset ids', () => {
    const { project } = readEpd(fixture('demo-project.epd'));
    expect(() => writeEpd(withAssets(project), new Map(), options)).toThrow(/missing/);
    const unsafe = withAssets(project);
    unsafe.company.logoAssetId = '../x';
    const png: ProjectAsset = { mimeType: 'image/png', bytes: new Uint8Array([1]) };
    expect(() =>
      writeEpd(
        unsafe,
        new Map([
          ['bg1', png],
          ['../x', png],
        ]),
        options,
      ),
    ).toThrow(/file name/);
  });

  // protects=clear errors when opening a wrong file; fails_when=non-zips, zips without manifest, bad JSON, missing assets or newer files open or throw another code; no_claim=messages
  it('rejects files it cannot open', () => {
    const { project } = readEpd(fixture('demo-project.epd'));
    const manifest = { format: 'epd', schemaVersion: 1, appVersion: '0.1.0', savedAt: '' };
    const zip = (files: Record<string, string>) =>
      zipSync(Object.fromEntries(Object.entries(files).map(([k, v]) => [k, strToU8(v)])));
    expect(codeOf(() => readEpd(fixture('plan-1000x800.png')))).toBe('not_a_project');
    expect(codeOf(() => readEpd(zip({ 'project.json': '{}' })))).toBe('not_a_project');
    expect(codeOf(() => readEpd(zip({ 'manifest.json': '{', 'project.json': '{}' })))).toBe(
      'invalid',
    );
    const withMissingAsset = zip({
      'manifest.json': JSON.stringify(manifest),
      'project.json': JSON.stringify(withAssets(project)),
    });
    expect(codeOf(() => readEpd(withMissingAsset))).toBe('invalid');
    const newer = zip({
      'manifest.json': JSON.stringify({ ...manifest, schemaVersion: 99 }),
      'project.json': JSON.stringify(project),
    });
    expect(codeOf(() => readEpd(newer))).toBe('newer_version');
  });
});
