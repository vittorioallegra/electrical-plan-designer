// Generic built-in catalog. Read-only; names are i18n keys. Ids are stable forever:
// they are stored in documents, BOM line keys and price overrides.
import {
  BUILTIN_PREFIX,
  type CatalogAttributes,
  type CatalogCategory,
  type CatalogItem,
} from './types';

function item(
  slug: string,
  category: CatalogCategory,
  unit: 'pcs' | 'm',
  attributes: CatalogAttributes = {},
  modules?: number,
): CatalogItem {
  return {
    id: `${BUILTIN_PREFIX}${slug}`,
    category,
    name: `catalog.builtin.${slug}`,
    unit,
    attributes,
    ...(modules === undefined ? {} : { modules }),
  };
}

const devices: CatalogItem[] = [
  item('socket_10_16', 'device', 'pcs', { deviceType: 'socket' }, 1),
  item('socket_schuko', 'device', 'pcs', { deviceType: 'schuko' }, 2),
  item('socket_universal', 'device', 'pcs', { deviceType: 'universal_socket' }, 2),
  item('switch', 'device', 'pcs', { deviceType: 'switch' }, 1),
  item('two_way_switch', 'device', 'pcs', { deviceType: 'two_way' }, 1),
  item('intermediate_switch', 'device', 'pcs', { deviceType: 'intermediate' }, 1),
  item('push_button', 'device', 'pcs', { deviceType: 'push_button' }, 1),
  item('dimmer', 'device', 'pcs', { deviceType: 'dimmer' }, 1),
  item('usb_charger', 'device', 'pcs', { deviceType: 'usb' }, 1),
  item('tv_socket', 'device', 'pcs', { deviceType: 'tv' }, 1),
  item('tv_sat_socket', 'device', 'pcs', { deviceType: 'tv' }, 1),
  item('data_socket_rj45', 'device', 'pcs', { deviceType: 'data' }, 1),
  item('blanking_cover', 'blanking_cover', 'pcs', {}, 1),
];

// A plate can be smaller than its box: a 503 takes a 1, 2 or 3 module plate (e.g. a centred
// 2-module schuko without blanking covers).
const plates = [1, 2, 3, 4, 5, 6, 7].map((m) => item(`plate_${m}m`, 'plate', 'pcs', {}, m));

const boxes = [
  item('box_503', 'box', 'pcs', {}, 3),
  item('box_504', 'box', 'pcs', {}, 4),
  item('box_506', 'box', 'pcs', {}, 7),
];

const junctionBoxes = ['92x92', '118x96', '152x98', '196x152', '294x152'].map((size) =>
  item(`junction_box_${size}`, 'junction_box', 'pcs'),
);

// Corrugated conduit (EN 61386): nominal outer Ø → minimum inner Ø.
const conduits = (
  [
    [16, 10.7],
    [20, 14.1],
    [25, 18.3],
    [32, 24.3],
  ] as const
).map(([outer, inner]) =>
  item(`conduit_${outer}`, 'conduit', 'm', { outerDiameter: outer, innerDiameter: inner }),
);

// H07V-K single-core cable: cross-section mm² → typical outer Ø mm.
export const cableOuterDiameters: Record<string, number> = {
  '1.5': 3.0,
  '2.5': 3.6,
  '4': 4.2,
  '6': 4.8,
  '10': 6.3,
};

/** Id of the built-in H07V-K cable of a cross-section (its price applies to every color). */
export function builtinCableId(crossSection: number): string {
  return `builtin:cable_h07vk_${String(crossSection).replace('.', '_')}`;
}

const cables = Object.entries(cableOuterDiameters).map(([section, outer]) =>
  item(`cable_h07vk_${section.replace('.', '_')}`, 'cable', 'm', {
    crossSection: Number(section),
    outerDiameter: outer,
  }),
);

const mcbs = [6, 10, 16, 20, 25, 32].map((a) =>
  item(
    `mcb_1pn_c${a}`,
    'panel_device',
    'pcs',
    { panelDeviceType: 'mcb', poles: '1P+N', ratingA: a, curve: 'C' },
    1,
  ),
);

const mcbs2p = [10, 16, 20, 25, 32, 40].map((a) =>
  item(
    `mcb_2p_c${a}`,
    'panel_device',
    'pcs',
    { panelDeviceType: 'mcb', poles: '2P', ratingA: a, curve: 'C' },
    2,
  ),
);

const rcds = [25, 40].flatMap((a) =>
  (['A', 'AC'] as const).map((type) =>
    item(
      `rcd_2p_${a}a_30ma_${type.toLowerCase()}`,
      'panel_device',
      'pcs',
      { panelDeviceType: 'rcd', poles: '2P', ratingA: a, sensitivityMa: 30, rcdType: type },
      2,
    ),
  ),
);

const rcbos = [10, 16, 20, 25].map((a) =>
  item(
    `rcbo_1pn_c${a}_30ma_a`,
    'panel_device',
    'pcs',
    {
      panelDeviceType: 'rcbo',
      poles: '1P+N',
      ratingA: a,
      curve: 'C',
      sensitivityMa: 30,
      rcdType: 'A',
    },
    2,
  ),
);

const rcbos2p = [10, 16, 20, 25, 32].map((a) =>
  item(
    `rcbo_2p_c${a}_30ma_a`,
    'panel_device',
    'pcs',
    {
      panelDeviceType: 'rcbo',
      poles: '2P',
      ratingA: a,
      curve: 'C',
      sensitivityMa: 30,
      rcdType: 'A',
    },
    4,
  ),
);

const otherPanelDevices = [
  item(
    'isolator_2p_40a',
    'panel_device',
    'pcs',
    { panelDeviceType: 'isolator', poles: '2P', ratingA: 40 },
    2,
  ),
  item(
    'isolator_2p_63a',
    'panel_device',
    'pcs',
    { panelDeviceType: 'isolator', poles: '2P', ratingA: 63 },
    2,
  ),
  item('spd_type2', 'panel_device', 'pcs', { panelDeviceType: 'spd', poles: '1P+N' }, 2),
];

// Shelly smart devices. The Pro line sits on the DIN rail; widths from Shelly's knowledge base
// (19 mm: 1 module; Pro 3 and Pro 4PM 53 mm: 3 modules). The in-box models take no plate
// module; they are the Gen3 models. Codes are the store's product codes (shelly.com, 2026-11-17).
const shellyDin = (
  [
    ['shelly_pro_1', 1, 1, 'FG3800235268001'],
    ['shelly_pro_1pm', 1, 1, 'FG3800235268018'],
    ['shelly_pro_2', 1, 2, 'FG3800235268025'],
    ['shelly_pro_2pm', 1, 2, 'FG3800235268032'],
    ['shelly_pro_3', 3, 3, 'FG3800235268094'],
    ['shelly_pro_4pm', 3, 4, 'FG3800235268049'],
    ['shelly_pro_em_50', 1, 2, 'FG3800235268148'],
  ] as const
).map(([slug, modules, channels, code]) => ({
  ...item(slug, 'smart_device', 'pcs', { smartMount: 'din', channels }, modules),
  code,
}));

// The 2PM Gen3 sells only as a 2-pack: its code is the pack's (docs/specs/shelly-prices.md).
const shellyBox = (
  [
    ['shelly_1_gen3', 1, 'FG3800235261767'],
    ['shelly_1pm_gen3', 1, 'FG3800235261798'],
    ['shelly_1_mini_gen3', 1, 'FG3800235261576'],
    ['shelly_1pm_mini_gen3', 1, 'FG3800235261590'],
    ['shelly_2pm_gen3', 2, 'FG3800235261910'],
  ] as const
).map(([slug, channels, code]) => ({
  ...item(slug, 'smart_device', 'pcs', { smartMount: 'box', channels }),
  code,
}));

const enclosures = [1, 2, 3].map((rails) =>
  item(`enclosure_${rails * 12}m`, 'enclosure', 'pcs', { rails, modulesPerRail: 12 }, rails * 12),
);

const builtinGenericCatalog: readonly CatalogItem[] = [
  ...devices,
  ...plates,
  ...boxes,
  ...junctionBoxes,
  ...conduits,
  ...cables,
  ...mcbs,
  ...mcbs2p,
  ...rcds,
  ...rcbos,
  ...rcbos2p,
  ...otherPanelDevices,
  ...enclosures,
];

/** The built-in Shelly models: built-in items, listed in Settings as a catalog of their own. */
export const shellyCatalog: readonly CatalogItem[] = [...shellyDin, ...shellyBox];

/**
 * The built-in catalogs as Settings lists them: the generic items and the Shelly models. Their
 * items are all built-ins (ids `builtin:<slug>`, names i18n keys); `nameKey` is the i18n key of
 * the catalog's name, `badgeKey` of its short name in the Catalog column.
 */
export const builtinCatalogs: readonly {
  id: 'builtin' | 'builtin-shelly';
  nameKey: string;
  badgeKey: string;
  items: readonly CatalogItem[];
}[] = [
  {
    id: 'builtin',
    nameKey: 'catalog.builtinCatalog',
    badgeKey: 'catalog.builtinBadge',
    items: builtinGenericCatalog,
  },
  {
    id: 'builtin-shelly',
    nameKey: 'catalog.shellyCatalog',
    badgeKey: 'catalog.shellyBadge',
    items: shellyCatalog,
  },
];

/** Every built-in item, from every built-in catalog. */
export const builtinCatalog: readonly CatalogItem[] = builtinCatalogs.flatMap((c) => c.items);

export const builtinById: ReadonlyMap<string, CatalogItem> = new Map(
  builtinCatalog.map((i) => [i.id, i]),
);

export const DEFAULT_CONDUIT_ID = 'builtin:conduit_20';
