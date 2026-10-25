import { Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useCatalog } from '@/api/catalog';
import { Button } from '@/components/ui/Button';
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
    <>
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
              <span className="block text-xs leading-tight text-text-muted">{itemName(item)}</span>
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
    </>
  );
}
