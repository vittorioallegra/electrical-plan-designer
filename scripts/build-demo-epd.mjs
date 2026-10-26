// Generates tests/fixtures/demo-project.epd from the demo drawing (tests/fixtures/demo-project.json)
// and the demo business data below. Run: pnpm demo:epd
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
export const demoCompany = {
  businessName: 'Demo Electric',
  vatNumber: '',
  address: '',
  phone: '+39 000 0000000',
  email: '',
};

/** [category, name, code, price (cents), unit, modules, attributes] */
export const demoCatalogRows = [
  ['device', 'Schuko socket (brand)', 'SCH-01', 690, 'pcs', 2, { deviceType: 'schuko' }],
  [
    'cable',
    'H07V-K 2.5 mm² brown',
    'C25-BR',
    48,
    'm',
    null,
    { crossSection: 2.5, color: 'brown', outerDiameter: 3.6 },
  ],
  [
    'conduit',
    'Corrugated 20 mm (brand)',
    'TC20',
    35,
    'm',
    null,
    { outerDiameter: 20, innerDiameter: 14.1 },
  ],
];

export const DEMO_CATALOG_ID = 'demo';
export const DEMO_SAVED_AT = '2026-10-26T00:00:00.000Z';

/** The demo ProjectFile (project.json) around the given drawing. */
export function buildDemoProject(doc) {
  return {
    meta: demoMeta,
    company: demoCompany,
    settings: demoSettings,
    quote: demoQuote,
    catalogs: [
      {
        id: DEMO_CATALOG_ID,
        name: 'Demo catalog',
        importedAt: DEMO_SAVED_AT,
        items: demoCatalogRows.map(
          ([category, name, code, unitPrice, unit, modules, attributes]) => ({
            id: `${DEMO_CATALOG_ID}:${code}`,
            category,
            name,
            code,
            unitPrice,
            unit,
            ...(modules === null ? {} : { modules }),
            attributes,
          }),
        ),
      },
    ],
    priceOverrides: {},
    boxPresets: [],
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
