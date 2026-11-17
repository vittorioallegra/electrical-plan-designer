import { Plus } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { isSmartDin } from '@epd/domain/catalog/attributes';
import type { CatalogItem } from '@epd/domain/catalog/types';
import { useCatalog } from '@/hooks/useCatalog';
import { Badge } from '@/components/ui/Badge';
import { IconButton } from '@/components/ui/IconButton';
import { PanelSection } from '@/components/ui/PanelSection';
import { addDevice, defaultDeviceLabel } from '@/features/panel/utils/commands';
import { useItemName } from '@/hooks/useItemName';
import { useItemsOf } from '@/hooks/useItemsOf';
import { useEditorContext } from '@/stores/editor/EditorContext';

/**
 * Items that go on a rail: panel devices, then DIN smart devices (which only take room). Drag
 * one onto a rail, or add it at the first free slot.
 */
export function DevicePalette({ readOnly }: { readOnly: boolean }) {
  const { t } = useTranslation();
  const panelDevices = useItemsOf('panel_device');
  const smartDevices = useItemsOf('smart_device');
  const smartDin = useMemo(() => smartDevices.filter(isSmartDin), [smartDevices]);
  return (
    <>
      <PanelSection title={t('panel.palette')}>
        <PaletteList items={panelDevices} readOnly={readOnly} />
      </PanelSection>
      {smartDin.length > 0 ? (
        <PanelSection title={t('panel.smartPalette')}>
          <PaletteList items={smartDin} readOnly={readOnly} />
        </PanelSection>
      ) : null}
    </>
  );
}

function PaletteList({ items, readOnly }: { items: CatalogItem[]; readOnly: boolean }) {
  const { t } = useTranslation();
  const { store } = useEditorContext();
  const { lookup } = useCatalog();
  const itemName = useItemName();
  return (
    <ul className="flex flex-col gap-0.5">
      {items.map((item) => (
        <li
          key={item.id}
          draggable={!readOnly}
          onDragStart={(e) =>
            e.dataTransfer.setData(
              'application/x-epd',
              JSON.stringify({ kind: 'item', itemId: item.id }),
            )
          }
          className="flex min-h-9 cursor-grab items-center gap-2 rounded-sm px-2 py-1 hover:bg-hover"
        >
          <span className="min-w-0 flex-1" title={itemName(item)}>
            <span className="block truncate font-medium">
              {defaultDeviceLabel(item) || itemName(item)}
            </span>
            <span className="block truncate text-small text-text-muted">{itemName(item)}</span>
          </span>
          <Badge>{t('panel.modulesShort', { count: item.modules ?? 1 })}</Badge>
          <IconButton
            label={t('panel.add', { name: itemName(item) })}
            icon={<Plus size={14} />}
            disabled={readOnly}
            onClick={() => addDevice(store, item, lookup)}
          />
        </li>
      ))}
    </ul>
  );
}
