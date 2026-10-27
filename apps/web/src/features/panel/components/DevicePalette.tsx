import { Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useCatalog } from '@/hooks/useCatalog';
import { Badge } from '@/components/ui/Badge';
import { IconButton } from '@/components/ui/IconButton';
import { PanelSection } from '@/components/ui/PanelSection';
import { addDevice, defaultDeviceLabel } from '@/features/panel/utils/commands';
import { useItemName } from '@/hooks/useItemName';
import { useItemsOf } from '@/hooks/useItemsOf';
import { useEditorContext } from '@/stores/editor/EditorContext';

/** Panel devices of the catalog: drag one onto a rail, or add it at the first free slot. */
export function DevicePalette({ readOnly }: { readOnly: boolean }) {
  const { t } = useTranslation();
  const { store } = useEditorContext();
  const { lookup } = useCatalog();
  const itemName = useItemName();
  const palette = useItemsOf('panel_device');
  return (
    <PanelSection title={t('panel.palette')}>
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
    </PanelSection>
  );
}
