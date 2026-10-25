// Panel designer commands (v1 edits the first panel of the doc).
import type { CatalogLookup } from '@epd/domain/catalog/lookup';
import type { CatalogItem } from '@epd/domain/catalog/types';
import { newId } from '@epd/domain/ids';
import { deviceWidth, firstFreeSlot } from '@epd/domain/panel';
import type { Panel, PanelDevice } from '@epd/domain/types';
import type { EditorStore } from '@/state/editorStore';

export function defaultDeviceLabel(item: CatalogItem | undefined): string {
  const a = item?.attributes;
  switch (a?.panelDeviceType) {
    case 'mcb':
      return `${a.curve ?? ''}${a.ratingA ?? ''}`;
    case 'rcd':
      return `ΔI ${a.ratingA ?? ''}A ${a.sensitivityMa ?? ''}mA`;
    case 'rcbo':
      return `${a.curve ?? ''}${a.ratingA ?? ''} ΔI ${a.sensitivityMa ?? ''}mA`;
    case 'isolator':
      return `I ${a.ratingA ?? ''}A`;
    case 'spd':
      return 'SPD';
    default:
      return '';
  }
}

const editPanel = (store: EditorStore, label: string, fn: (p: Panel) => void) =>
  store.getState().applyCommand(label, (d) => {
    const panel = d.doc.panels[0];
    if (panel) fn(panel);
  });

/** Adds a device at `at`, or at the first free slot (a new rail when the panel is full). */
export function addDevice(
  store: EditorStore,
  item: CatalogItem,
  catalog: CatalogLookup,
  at?: { rail: number; slot: number },
): string | null {
  const panel = store.getState().data.doc.panels[0];
  if (!panel) return null;
  const width = deviceWidth({ itemId: item.id }, catalog);
  const place = at ?? firstFreeSlot(panel, catalog, width) ?? { rail: panel.dinRails, slot: 0 };
  const device: PanelDevice = {
    id: newId(),
    itemId: item.id,
    rail: place.rail,
    slot: place.slot,
    label: defaultDeviceLabel(item),
  };
  const result = editPanel(store, 'add panel device', (p) => void p.devices.push(device));
  if (!result.ok) return null;
  store.getState().setUi({ selection: [device.id] });
  return device.id;
}

export function updateDevice(
  store: EditorStore,
  id: string,
  label: string,
  fn: (d: PanelDevice) => void,
) {
  return editPanel(store, label, (p) => {
    const device = p.devices.find((d) => d.id === id);
    if (device) fn(device);
  });
}

export function moveDevice(store: EditorStore, id: string, rail: number, slot: number) {
  return updateDevice(store, id, 'move panel device', (d) => {
    d.rail = Math.max(0, rail);
    d.slot = Math.max(0, slot);
  });
}

export function setUpstream(store: EditorStore, id: string, upstreamId: string | null) {
  return updateDevice(store, id, 'set upstream', (d) => {
    if (upstreamId) d.upstreamDeviceId = upstreamId;
    else delete d.upstreamDeviceId;
  });
}

export function deleteDevice(store: EditorStore, id: string) {
  editPanel(store, 'delete panel device', (p) => {
    p.devices = p.devices.filter((d) => d.id !== id);
    for (const d of p.devices) if (d.upstreamDeviceId === id) delete d.upstreamDeviceId;
  });
  store.getState().setUi({ selection: [] });
}

export function setEnclosure(store: EditorStore, item: CatalogItem | undefined) {
  return editPanel(store, 'set enclosure', (p) => {
    if (!item) {
      delete p.enclosureItemId;
      return;
    }
    p.enclosureItemId = item.id;
    p.dinRails = item.attributes.rails ?? p.dinRails;
    p.modulesPerRail = item.attributes.modulesPerRail ?? p.modulesPerRail;
  });
}

export function setLayout(
  store: EditorStore,
  patch: Partial<Pick<Panel, 'dinRails' | 'modulesPerRail'>>,
) {
  return editPanel(store, 'panel layout', (p) => Object.assign(p, patch));
}
