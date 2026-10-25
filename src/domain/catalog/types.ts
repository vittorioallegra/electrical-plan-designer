import type { CableColor } from '../types';

export type CatalogCategory =
  | 'device'
  | 'blanking_cover'
  | 'plate'
  | 'box'
  | 'junction_box'
  | 'conduit'
  | 'cable'
  | 'panel_device'
  | 'enclosure';

export type DeviceType =
  | 'socket'
  | 'schuko'
  | 'universal_socket'
  | 'switch'
  | 'two_way'
  | 'intermediate'
  | 'push_button'
  | 'dimmer'
  | 'usb'
  | 'tv'
  | 'data'
  | 'other';

export type PanelDeviceType = 'mcb' | 'rcd' | 'rcbo' | 'isolator' | 'spd' | 'other';

export interface CatalogAttributes {
  deviceType?: DeviceType;
  /** Conduit outer/inner diameter, mm. */
  outerDiameter?: number;
  innerDiameter?: number;
  /** Cable cross-section, mm²; cable outer Ø uses `outerDiameter`. */
  crossSection?: number;
  color?: CableColor;
  panelDeviceType?: PanelDeviceType;
  poles?: string;
  ratingA?: number;
  curve?: 'B' | 'C' | 'D';
  sensitivityMa?: number;
  rcdType?: 'A' | 'AC' | 'F' | 'B';
  /** Enclosure layout. */
  rails?: number;
  modulesPerRail?: number;
}

export interface CatalogItem {
  /** `builtin:<slug>` for built-ins, a generated id for user items. */
  id: string;
  /** null for built-ins. */
  ownerId: string | null;
  category: CatalogCategory;
  /** Built-ins: an i18n key (`catalog.builtin.<slug>`). User items: the typed name. */
  name: string;
  code?: string;
  /** Integer cents. */
  unitPrice?: number;
  unit: 'pcs' | 'm';
  /** DIN modules (panel devices) or box/plate/device modules. */
  modules?: number;
  attributes: CatalogAttributes;
  /** User items are archived instead of deleted. */
  archived?: boolean;
}

export function isBuiltin(item: Pick<CatalogItem, 'ownerId'>): boolean {
  return item.ownerId === null;
}
