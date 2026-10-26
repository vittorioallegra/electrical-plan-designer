// Generates tests/fixtures/demo-project.epd from the demo drawing (tests/fixtures/demo-project.json)
// and the demo data below (the copies of the built-in items the drawing uses). Run: pnpm demo:epd
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { strToU8, zipSync } from 'fflate';

// Mirrors defaultProjectSettings() / defaultQuoteSettings(); a unit test keeps them equal.
export const demoSettings = {
  mountingHeights: { socket: 0.3, switch: 1.1, junctionBox: 0.25, panel: 1.5 },
  defaultFloorHeight: 2.7,
  defaultRunElevation: 'floor',
  terminationSlack: 0.2,
  wastePercent: 10,
  conduitFillFactor: 1.3,
};
export const demoQuote = {
  settings: { materialAdjustmentPercent: 0, vatPercent: 22, laborLines: [] },
  issued: [],
};
export const demoMeta = {
  name: 'Demo house',
  clientName: 'Demo client',
  address: 'Via Roma 1, Milano',
  createdAt: '2026-10-26T00:00:00.000Z',
};
/**
 * The built-in items the demo drawing uses, as the project's copies [slug, category, unit,
 * attributes, modules]; a unit test checks them against the built-in catalog and the drawing.
 */
export const demoItemRows = [
  ['blanking_cover', 'blanking_cover', 'pcs', {}, 1],
  ['box_503', 'box', 'pcs', {}, 3],
  ['conduit_16', 'conduit', 'm', { outerDiameter: 16, innerDiameter: 10.7 }, null],
  ['conduit_20', 'conduit', 'm', { outerDiameter: 20, innerDiameter: 14.1 }, null],
  ['conduit_25', 'conduit', 'm', { outerDiameter: 25, innerDiameter: 18.3 }, null],
  ['enclosure_12m', 'enclosure', 'pcs', { rails: 1, modulesPerRail: 12 }, 12],
  [
    'isolator_2p_40a',
    'panel_device',
    'pcs',
    { panelDeviceType: 'isolator', poles: '2P', ratingA: 40 },
    2,
  ],
  ['junction_box_118x96', 'junction_box', 'pcs', {}, null],
  ['junction_box_92x92', 'junction_box', 'pcs', {}, null],
  [
    'mcb_1pn_c10',
    'panel_device',
    'pcs',
    { panelDeviceType: 'mcb', poles: '1P+N', ratingA: 10, curve: 'C' },
    1,
  ],
  [
    'mcb_1pn_c16',
    'panel_device',
    'pcs',
    { panelDeviceType: 'mcb', poles: '1P+N', ratingA: 16, curve: 'C' },
    1,
  ],
  ['plate_3m', 'plate', 'pcs', {}, 3],
  [
    'rcd_2p_40a_30ma_a',
    'panel_device',
    'pcs',
    { panelDeviceType: 'rcd', poles: '2P', ratingA: 40, sensitivityMa: 30, rcdType: 'A' },
    2,
  ],
  ['socket_10_16', 'device', 'pcs', { deviceType: 'socket' }, 1],
  ['socket_schuko', 'device', 'pcs', { deviceType: 'schuko' }, 2],
  ['switch', 'device', 'pcs', { deviceType: 'switch' }, 1],
];

export const DEMO_SAVED_AT = '2026-10-26T00:00:00.000Z';

/** The demo ProjectFile (project.json) around the given drawing: no prices, so its quote is open. */
export function buildDemoProject(doc) {
  return {
    meta: demoMeta,
    settings: demoSettings,
    quote: demoQuote,
    items: demoItemRows.map(([slug, category, unit, attributes, modules]) => ({
      id: `builtin:${slug}`,
      category,
      name: `catalog.builtin.${slug}`,
      unit,
      ...(modules === null ? {} : { modules }),
      attributes,
    })),
    cablePrices: {},
    doc,
  };
}

export function buildDemoManifest(appVersion) {
  return { format: 'epd', schemaVersion: 1, appVersion, savedAt: DEMO_SAVED_AT };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const doc = JSON.parse(readFileSync('tests/fixtures/demo-project.json', 'utf8'));
  const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
  const mtime = new Date(DEMO_SAVED_AT);
  const zip = zipSync({
    'manifest.json': [strToU8(JSON.stringify(buildDemoManifest(version), null, 2)), { mtime }],
    'project.json': [strToU8(JSON.stringify(buildDemoProject(doc))), { mtime }],
  });
  writeFileSync('tests/fixtures/demo-project.epd', zip);
  console.log('build-demo-epd: wrote tests/fixtures/demo-project.epd');
}
