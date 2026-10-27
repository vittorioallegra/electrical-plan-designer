import { Trash2 } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { CatalogItem } from '@epd/domain/catalog/types';
import type { Panel, PanelDevice } from '@epd/domain/types';
import { useCatalog } from '@/hooks/useCatalog';
import { Button } from '@/components/ui/Button';
import { NumberInput } from '@/components/ui/NumberInput';
import { Select } from '@/components/ui/Select';
import {
  deleteDevice,
  moveDevice,
  setUpstream,
  updateDevice,
} from '@/features/panel/utils/commands';
import { useItemName } from '@/hooks/useItemName';
import { useEditor, useEditorContext } from '@/stores/editor/EditorContext';

/** Label, position, upstream device and circuits of the selected device. */
export function DeviceInspector({ panel, device }: { panel: Panel; device: PanelDevice }) {
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
        <Select
          value={device.upstreamDeviceId ?? ''}
          disabled={readOnly}
          onValueChange={(v) => setUpstream(store, device.id, v || null)}
          options={[
            { value: '', label: t('panel.noUpstream') },
            ...upstreamOptions.map((d) => ({
              value: d.id,
              label: d.label || itemName(lookup(d.itemId), d.itemId),
            })),
          ]}
        />
      </label>
      <p className="text-text-muted">
        {circuits.length > 0
          ? t('panel.circuitsOn', { names: circuits.map((c) => c.name).join(', ') })
          : t('panel.noCircuits')}
      </p>
      <Button
        variant="danger-ghost"
        disabled={readOnly}
        onClick={() => deleteDevice(store, device.id)}
      >
        <Trash2 size={16} />
        {circuits.length > 0
          ? t('panel.deleteUsed', { count: circuits.length })
          : t('inspector.delete')}
      </Button>
    </div>
  );
}
