import { readFileSync } from 'node:fs';
import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { builtinById } from '@epd/domain/catalog/builtin';
import { cableKeysOf, referencedItemIds } from '@epd/domain/catalog/copies';
import { defaultProjectSettings, defaultQuoteSettings } from '@epd/domain/defaults';
import { loadProjectFile, type ProjectFile } from '@epd/domain/projectFile';
import demo from '../tests/fixtures/demo-project.json';
import pkg from '../package.json';
// @ts-expect-error plain JS module without types
import { buildDemoManifest, buildDemoProject, demoQuote, demoSettings } from './build-demo-epd.mjs';

describe('demo project file', () => {
  // protects=demo .epd drift; fails_when=demo-project.epd differs from the drawing fixture, the demo data or the domain defaults, or does not load; no_claim=zip byte layout
  it('demo-project.epd is generated from the fixture and loads', () => {
    expect(demoSettings).toEqual(defaultProjectSettings());
    expect(demoQuote).toEqual({ settings: defaultQuoteSettings(), issued: [] });
    const files = unzipSync(readFileSync('tests/fixtures/demo-project.epd'));
    expect(Object.keys(files).sort()).toEqual(['manifest.json', 'project.json']);
    const manifest: unknown = JSON.parse(strFromU8(files['manifest.json']!));
    const project: unknown = JSON.parse(strFromU8(files['project.json']!));
    expect(manifest).toEqual(buildDemoManifest(pkg.version));
    expect(project).toEqual(buildDemoProject(demo));
    expect(loadProjectFile(manifest, project)).toEqual(project);
  });

  // protects=AC 11 the demo file holds a copy of every item it uses and nothing from catalogs, company or presets; fails_when=a copy differs from its built-in, an used item has no copy, or a copy or cable price is unused; no_claim=prices
  it('demo-project.epd holds exactly the copies of what the drawing uses', () => {
    const project = buildDemoProject(demo) as ProjectFile;
    expect(Object.keys(project).sort()).toEqual(
      ['cablePrices', 'doc', 'items', 'meta', 'quote', 'settings'].sort(),
    );
    expect(new Set(project.items.map((i) => i.id))).toEqual(referencedItemIds(project.doc));
    for (const item of project.items) expect(item).toEqual(builtinById.get(item.id));
    const cables = cableKeysOf(project.doc);
    for (const key of Object.keys(project.cablePrices)) expect(cables.has(key)).toBe(true);
  });
});
