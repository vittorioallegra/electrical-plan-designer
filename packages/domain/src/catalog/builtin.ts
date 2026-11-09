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

const enclosures = [1, 2, 3].map((rails) =>
  item(`enclosure_${rails * 12}m`, 'enclosure', 'pcs', { rails, modulesPerRail: 12 }, rails * 12),
);

export const builtinCatalog: readonly CatalogItem[] = [
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

export const builtinById: ReadonlyMap<string, CatalogItem> = new Map(
  builtinCatalog.map((i) => [i.id, i]),
);

export const DEFAULT_CONDUIT_ID = 'builtin:conduit_20';
