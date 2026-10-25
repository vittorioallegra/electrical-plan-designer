import { Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo, type DragEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import type { CatalogItem } from '@epd/domain/catalog/types';
import { deviceWidth, isRcdType, suggestEnclosure, totalModules } from '@epd/domain/panel';
import type { Panel, PanelDevice } from '@epd/domain/types';
import { useEditor, useEditorContext } from '@/stores/editor/EditorContext';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';
import { NumberInput } from '@/components/ui/NumberInput';
import { useAnalysis } from '@/hooks/useAnalysis';
import { useCatalog, useItemName, useItemsOf } from '@/features/catalog/hooks/useCatalog';
import {
  addDevice,
  defaultDeviceLabel,
  deleteDevice,
  moveDevice,
  setEnclosure,
  setLayout,
  setUpstream,
  updateDevice,
} from '@/features/panel/utils/commands';

const MODULE_PX = 52;
const groupColors = ['#2563eb', '#16a34a', '#d97706', '#9333ea', '#db2777', '#0891b2'];

type DragData = { kind: 'item'; itemId: string } | { kind: 'device'; deviceId: string };

function readDrag(e: DragEvent): DragData | null {
  try {
    return JSON.parse(e.dataTransfer.getData('application/x-epd')) as DragData;
  } catch {
    return null;
  }
}

export function PanelView() {
  const { t } = useTranslation();
  const panel = useEditor((s) => s.data.doc.panels[0]);
  if (!panel) {
    return (
      <div className="p-6">
        <h1 className="mb-2 text-xl font-semibold">{t('pages.panel')}</h1>
        <p className="mb-3 text-text-muted">{t('panel.noPanel')}</p>
        <Link to="../plan" className="text-accent underline">
          {t('panel.goToPlan')}
        </Link>
      </div>
    );
  }
  return <PanelDesigner panel={panel} />;
}

function PanelDesigner({ panel }: { panel: Panel }) {
  const { t } = useTranslation();
  const { store } = useEditorContext();
  const readOnly = useEditor((s) => s.readOnly);
  const selection = useEditor((s) => s.ui.selection);
  const { lookup } = useCatalog();
  const itemName = useItemName();
  const palette = useItemsOf('panel_device');
  const { warnings } = useAnalysis();
  const selected = panel.devices.find((d) => selection.includes(d.id));

  const flagged = useMemo(
    () =>
      new Map(
        warnings
          .filter((w) => w.id === 'panel_capacity' && w.elementRef.kind === 'panel_device')
          .map((w) => [w.elementRef.id, String(w.params.reason)]),
      ),
    [warnings],
  );
  const groupColor = useMemo(() => {
    const colors = new Map<string, string>();
    const byId = new Map(panel.devices.map((d) => [d.id, d]));
    let i = 0;
    for (const d of panel.devices) {
      if (isRcdType(d, lookup)) colors.set(d.id, groupColors[i++ % groupColors.length]!);
    }
    for (const d of panel.devices) {
      let up = d.upstreamDeviceId ? byId.get(d.upstreamDeviceId) : undefined;
      for (let depth = 0; up && !colors.has(d.id) && depth < 32; depth++) {
        if (colors.has(up.id) && isRcdType(up, lookup)) colors.set(d.id, colors.get(up.id)!);
        up = up.upstreamDeviceId ? byId.get(up.upstreamDeviceId) : undefined;
      }
    }
    return colors;
  }, [panel.devices, lookup]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        !selected ||
        readOnly ||
        (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
      )
        return;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        moveDevice(
          store,
          selected.id,
          selected.rail,
          selected.slot + (e.key === 'ArrowLeft' ? -1 : 1),
        );
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        moveDevice(
          store,
          selected.id,
          selected.rail + (e.key === 'ArrowUp' ? -1 : 1),
          selected.slot,
        );
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        deleteDevice(store, selected.id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected, readOnly, store]);

  const maxRail = Math.max(panel.dinRails, ...panel.devices.map((d) => d.rail + 1));
  const maxSlot = Math.max(
    panel.modulesPerRail,
    ...panel.devices.map((d) => d.slot + deviceWidth(d, lookup)),
  );

  function onDropAt(e: DragEvent, rail: number, slot: number) {
    e.preventDefault();
    const data = readDrag(e);
    if (!data || readOnly) return;
    if (data.kind === 'item') {
      const item = lookup(data.itemId);
      if (item) addDevice(store, item, lookup, { rail, slot });
    } else {
      moveDevice(store, data.deviceId, rail, slot);
    }
  }

  function onDropOnDevice(e: DragEvent, target: PanelDevice) {
    const data = readDrag(e);
    if (data?.kind !== 'device' || data.deviceId === target.id || !isRcdType(target, lookup))
      return;
    e.preventDefault();
    e.stopPropagation();
    setUpstream(store, data.deviceId, target.id);
  }

  return (
    <div className="flex h-full">
      <aside
        className="w-60 overflow-y-auto border-r border-border p-2"
        aria-label={t('panel.palette')}
      >
        <h1 className="sr-only">{t('pages.panel')}</h1>
        <h2 className="mb-1 font-medium">{t('panel.palette')}</h2>
        <ul className="flex flex-col gap-0.5">
          {palette.map((item) => (
            <li
              key={item.id}
              draggable={!readOnly}
              onDragStart={(e) =>
                e.dataTransfer.setData(
                  'application/x-epd',
                  JSON.stringify({ kind: 'item', itemId: item.id }),
                )
              }
              className="flex cursor-grab items-center gap-1 rounded px-1 py-0.5 hover:bg-surface-muted"
            >
              <span className="min-w-0 flex-1" title={itemName(item)}>
                <span className="block font-medium">
                  {defaultDeviceLabel(item) || itemName(item)}
                </span>
                <span className="block text-xs leading-tight text-text-muted">
                  {itemName(item)}
                </span>
              </span>
              <span className="text-xs text-text-muted">
                {t('panel.modulesShort', { count: item.modules ?? 1 })}
              </span>
              <Button
                variant="ghost"
                aria-label={t('panel.add', { name: itemName(item) })}
                disabled={readOnly}
                onClick={() => addDevice(store, item, lookup)}
              >
                <Plus size={14} />
              </Button>
            </li>
          ))}
        </ul>
      </aside>

      <div className="min-w-0 flex-1 overflow-auto p-4">
        <div
          className="inline-flex flex-col gap-3 rounded-lg border-2 border-border bg-surface-muted p-3"
          data-testid="panel-front"
        >
          {Array.from({ length: maxRail }, (_, rail) => (
            <div
              key={rail}
              className="relative h-24"
              style={{ width: maxSlot * MODULE_PX }}
              aria-label={t('panel.rail', { n: rail + 1 })}
              role="group"
            >
              {Array.from({ length: maxSlot }, (_, slot) => {
                const outside = rail >= panel.dinRails || slot >= panel.modulesPerRail;
                return (
                  <div
                    key={slot}
                    className={cn(
                      'absolute top-0 h-full border border-dashed border-border',
                      outside && 'hatched',
                    )}
                    style={{ left: slot * MODULE_PX, width: MODULE_PX }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => onDropAt(e, rail, slot)}
                  />
                );
              })}
              <div className="pointer-events-none absolute top-1/2 h-2 w-full -translate-y-1/2 bg-border" />
              {panel.devices
                .filter((d) => d.rail === rail)
                .map((d) => {
                  const item = lookup(d.itemId);
                  const width = deviceWidth(d, lookup);
                  const color = groupColor.get(d.id);
                  return (
                    <button
                      key={d.id}
                      type="button"
                      draggable={!readOnly}
                      data-testid={`device-${d.id}`}
                      data-warning={flagged.get(d.id)}
                      aria-pressed={selection.includes(d.id)}
                      aria-label={t('panel.deviceLabel', {
                        label: d.label || itemName(item, d.itemId),
                        slot: d.slot + 1,
                        rail: rail + 1,
                      })}
                      onDragStart={(e) =>
                        e.dataTransfer.setData(
                          'application/x-epd',
                          JSON.stringify({ kind: 'device', deviceId: d.id }),
                        )
                      }
                      onDragOver={(e) => isRcdType(d, lookup) && e.preventDefault()}
                      onDrop={(e) => onDropOnDevice(e, d)}
                      onClick={() => store.getState().setUi({ selection: [d.id] })}
                      className={cn(
                        'absolute top-1 flex h-[calc(100%-0.5rem)] flex-col items-center justify-center overflow-hidden rounded border-2 bg-surface px-0.5 text-center text-xs leading-tight shadow-sm',
                        selection.includes(d.id) ? 'border-accent' : 'border-text-muted',
                        flagged.has(d.id) && 'hatched border-error',
                      )}
                      style={{
                        left: d.slot * MODULE_PX + 2,
                        width: width * MODULE_PX - 4,
                        borderTopColor: color,
                        borderTopWidth: color ? 6 : undefined,
                      }}
                    >
                      <span className="w-full truncate font-semibold" title={d.label}>
                        {d.label}
                      </span>
                      <span className={cn('text-text-muted', width < 2 && 'sr-only')}>
                        {item
                          ? t(
                              `catalog.panelDeviceTypes.${item.attributes.panelDeviceType ?? 'other'}`,
                            )
                          : t('catalog.missingItem', { id: d.itemId })}
                      </span>
                    </button>
                  );
                })}
            </div>
          ))}
        </div>
      </div>

      <aside
        className="w-72 overflow-y-auto border-l border-border p-2"
        aria-label={t('editor.inspector')}
      >
        {selected ? (
          <DeviceInspector panel={panel} device={selected} />
        ) : (
          <LayoutInspector panel={panel} />
        )}
      </aside>
    </div>
  );
}

function LayoutInspector({ panel }: { panel: Panel }) {
  const { t } = useTranslation();
  const { store } = useEditorContext();
  const readOnly = useEditor((s) => s.readOnly);
  const { lookup } = useCatalog();
  const itemName = useItemName();
  const enclosures = useItemsOf('enclosure');
  const used = totalModules(panel, lookup);
  const capacity = panel.dinRails * panel.modulesPerRail;
  const suggestion = suggestEnclosure(used, enclosures);
  return (
    <div className="flex flex-col gap-2" data-testid="panel-layout">
      <h2 className="font-medium">{t('panel.layout')}</h2>
      <p
        className={cn('tabular-nums', used > capacity && 'font-medium text-error')}
        data-testid="panel-totals"
      >
        {t('panel.totals', { used, capacity })}
      </p>
      <label className="flex flex-col gap-1">
        {t('panel.enclosure')}
        <select
          className="h-[var(--control-height)] rounded border border-border px-2"
          value={panel.enclosureItemId ?? ''}
          disabled={readOnly}
          onChange={(e) => setEnclosure(store, lookup(e.target.value))}
        >
          <option value="">{t('panel.noEnclosure')}</option>
          {enclosures.map((e) => (
            <option key={e.id} value={e.id}>
              {itemName(e)}
            </option>
          ))}
        </select>
      </label>
      {suggestion && suggestion.id !== panel.enclosureItemId ? (
        <div className="flex items-center gap-2 rounded bg-surface-muted p-2">
          <span className="flex-1">{t('panel.suggested', { name: itemName(suggestion) })}</span>
          <Button disabled={readOnly} onClick={() => setEnclosure(store, suggestion)}>
            {t('panel.useSuggestion')}
          </Button>
        </div>
      ) : null}
      <label className="flex flex-col gap-1">
        {t('panel.rails')}
        <NumberInput
          aria-label={t('panel.rails')}
          decimals={0}
          value={panel.dinRails}
          min={1}
          max={12}
          disabled={readOnly}
          onValueChange={(v) => setLayout(store, { dinRails: Math.round(v) })}
        />
      </label>
      <label className="flex flex-col gap-1">
        {t('panel.modulesPerRail')}
        <NumberInput
          aria-label={t('panel.modulesPerRail')}
          decimals={0}
          value={panel.modulesPerRail}
          min={1}
          max={72}
          disabled={readOnly}
          onValueChange={(v) => setLayout(store, { modulesPerRail: Math.round(v) })}
        />
      </label>
      <p className="text-text-muted">{t('panel.hint')}</p>
    </div>
  );
}

function DeviceInspector({ panel, device }: { panel: Panel; device: PanelDevice }) {
  const { t } = useTranslation();
  const { store } = useEditorContext();
  const readOnly = useEditor((s) => s.readOnly);
  const allCircuits = useEditor((s) => s.data.doc.circuits);
  const circuits = useMemo(
    () => allCircuits.filter((c) => c.panelDeviceId === device.id),
    [allCircuits, device.id],
  );
  const { lookup } = useCatalog();
  const itemName = useItemName();
  const item: CatalogItem | undefined = lookup(device.itemId);
  const upstreamOptions = panel.devices.filter((d) => d.id !== device.id);
  return (
    <div className="flex flex-col gap-2" data-testid="device-inspector">
      <h2 className="font-medium">{itemName(item, device.itemId)}</h2>
      <label className="flex flex-col gap-1">
        {t('panel.label')}
        <input
          key={device.id}
          className="h-[var(--control-height)] rounded border border-border px-2"
          defaultValue={device.label}
          disabled={readOnly}
          onBlur={(e) => {
            const label = e.target.value.trim();
            if (label !== device.label)
              updateDevice(store, device.id, 'rename device', (d) => void (d.label = label));
          }}
        />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1">
          {t('panel.railNumber')}
          <NumberInput
            aria-label={t('panel.railNumber')}
            decimals={0}
            value={device.rail + 1}
            min={1}
            max={24}
            disabled={readOnly}
            onValueChange={(v) => moveDevice(store, device.id, Math.round(v) - 1, device.slot)}
          />
        </label>
        <label className="flex flex-col gap-1">
          {t('panel.slotNumber')}
          <NumberInput
            aria-label={t('panel.slotNumber')}
            decimals={0}
            value={device.slot + 1}
            min={1}
            max={96}
            disabled={readOnly}
            onValueChange={(v) => moveDevice(store, device.id, device.rail, Math.round(v) - 1)}
          />
        </label>
      </div>
      <label className="flex flex-col gap-1">
        {t('panel.upstream')}
        <select
          className="h-[var(--control-height)] rounded border border-border px-2"
          value={device.upstreamDeviceId ?? ''}
          disabled={readOnly}
          onChange={(e) => setUpstream(store, device.id, e.target.value || null)}
        >
          <option value="">{t('panel.noUpstream')}</option>
          {upstreamOptions.map((d) => (
            <option key={d.id} value={d.id}>
              {d.label || itemName(lookup(d.itemId), d.itemId)}
            </option>
          ))}
        </select>
      </label>
      <p className="text-text-muted">
        {circuits.length > 0
          ? t('panel.circuitsOn', { names: circuits.map((c) => c.name).join(', ') })
          : t('panel.noCircuits')}
      </p>
      <Button variant="danger" disabled={readOnly} onClick={() => deleteDevice(store, device.id)}>
        <Trash2 size={16} />
        {circuits.length > 0
          ? t('panel.deleteUsed', { count: circuits.length })
          : t('inspector.delete')}
      </Button>
    </div>
  );
}
