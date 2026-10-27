import { useMemo, type DragEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { deviceWidth, isRcdType } from '@epd/domain/panel';
import type { Panel, PanelDevice } from '@epd/domain/types';
import { useCatalog } from '@/hooks/useCatalog';
import { addDevice, moveDevice, setUpstream } from '@/features/panel/utils/commands';
import { rcdGroupColors } from '@/features/panel/utils/rcdGroups';
import { useAnalysis } from '@/hooks/useAnalysis';
import { useItemName } from '@/hooks/useItemName';
import { cn } from '@/lib/cn';
import { useEditorContext } from '@/stores/editor/EditorContext';

const MODULE_PX = 52;

type DragData = { kind: 'item'; itemId: string } | { kind: 'device'; deviceId: string };

function readDrag(e: DragEvent): DragData | null {
  try {
    return JSON.parse(e.dataTransfer.getData('application/x-epd')) as DragData;
  } catch {
    return null;
  }
}

/**
 * Front view of the panel: DIN rails with their slots (hatched outside the enclosure) and the
 * devices. Drop a palette item on a slot to add it, a device on a slot to move it, a device on
 * an RCD to put it downstream.
 */
export function PanelFront({
  panel,
  selection,
  readOnly,
}: {
  panel: Panel;
  selection: string[];
  readOnly: boolean;
}) {
  const { t } = useTranslation();
  const { store } = useEditorContext();
  const { lookup } = useCatalog();
  const itemName = useItemName();
  const { warnings } = useAnalysis();

  const flagged = useMemo(
    () =>
      new Map(
        warnings
          .filter((w) => w.id === 'panel_capacity' && w.elementRef.kind === 'panel_device')
          .map((w) => [w.elementRef.id, String(w.params.reason)]),
      ),
    [warnings],
  );
  const groupColor = useMemo(() => rcdGroupColors(panel.devices, lookup), [panel.devices, lookup]);

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
    <div
      className="inline-flex flex-col gap-3 rounded-lg border border-border-strong bg-panel p-3"
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
                  'absolute top-0 h-full border border-dashed border-border-strong/60',
                  outside && 'hatched',
                )}
                style={{ left: slot * MODULE_PX, width: MODULE_PX }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => onDropAt(e, rail, slot)}
              />
            );
          })}
          <div className="pointer-events-none absolute top-1/2 h-2 w-full -translate-y-1/2 bg-pressed" />
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
                    'absolute top-1 flex h-[calc(100%-0.5rem)] flex-col items-center justify-center overflow-hidden rounded-sm border-2 bg-raised px-0.5 text-center text-small leading-tight',
                    selection.includes(d.id) ? 'border-accent' : 'border-border-strong',
                    flagged.has(d.id) && 'hatched border-error',
                  )}
                  style={{
                    left: d.slot * MODULE_PX + 2,
                    width: width * MODULE_PX - 4,
                    borderTopColor: color,
                    borderTopWidth: color ? 6 : undefined,
                  }}
                >
                  <span className="w-full truncate font-mono font-semibold" title={d.label}>
                    {d.label}
                  </span>
                  <span className={cn('text-label text-text-muted', width < 2 && 'sr-only')}>
                    {item
                      ? t(`catalog.panelDeviceTypes.${item.attributes.panelDeviceType ?? 'other'}`)
                      : t('catalog.missingItem', { id: d.itemId })}
                  </span>
                </button>
              );
            })}
        </div>
      ))}
    </div>
  );
}
