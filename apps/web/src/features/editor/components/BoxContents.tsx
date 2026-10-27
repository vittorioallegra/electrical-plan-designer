import { Minus, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { PlanNode } from '@epd/domain/types';
import { useEditor, useEditorContext } from '@/stores/editor/EditorContext';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { PanelSection } from '@/components/ui/PanelSection';
import { Select } from '@/components/ui/Select';
import { cn } from '@/lib/cn';
import { applyPresetTo } from '@/features/editor/utils/commands';
import { useCatalog } from '@/hooks/useCatalog';
import { useLibrary } from '@/stores/library/useLibrary';
import { useItemName } from '@/hooks/useItemName';
import { useItemsOf } from '@/hooks/useItemsOf';

/** Contents of a terminal box: devices, blanking covers and plate, with a modules counter. */
export function BoxContents({ node }: { node: PlanNode }) {
  const { t } = useTranslation();
  const { store } = useEditorContext();
  const readOnly = useEditor((s) => s.readOnly);
  const { lookup } = useCatalog();
  const boxPresets = useLibrary((s) => s.library.boxPresets);
  const itemName = useItemName();
  const devices = useItemsOf('device');
  const covers = useItemsOf('blanking_cover');
  const plates = useItemsOf('plate');
  const [adding, setAdding] = useState('');

  const contents = node.contents ?? [];
  const box = node.boxItemId ? lookup(node.boxItemId) : undefined;
  const used = contents.reduce((sum, c) => {
    const item = lookup(c.itemId);
    return item && item.category !== 'plate' ? sum + (item.modules ?? 0) * c.qty : sum;
  }, 0);
  const over = box?.modules !== undefined && used > box.modules;

  const update = (label: string, fn: (n: PlanNode) => void) =>
    store.getState().applyCommand(label, (d) => {
      const n = d.doc.nodes.find((x) => x.id === node.id);
      if (n) fn(n);
    });
  const setQty = (itemId: string, qty: number) =>
    update('box contents', (n) => {
      const list = n.contents ?? [];
      const line = list.find((c) => c.itemId === itemId);
      if (qty <= 0) n.contents = list.filter((c) => c.itemId !== itemId);
      else if (line) line.qty = qty;
      else n.contents = [...list, { itemId, qty }];
    });

  return (
    <PanelSection
      title={t('contents.title')}
      actions={
        <span
          className={cn(
            'font-mono tabular-nums',
            over ? 'font-medium text-error' : 'text-text-muted',
          )}
          data-testid="modules-counter"
        >
          {box?.modules !== undefined
            ? t('contents.modules', { used, available: box.modules })
            : t('contents.modulesNoBox', { used })}
        </span>
      }
    >
      <div className="flex flex-col gap-2" data-testid="box-contents">
        {contents.length === 0 ? <p className="text-text-muted">{t('contents.empty')}</p> : null}
        <ul className="flex flex-col gap-1">
          {contents.map((c) => (
            <li key={c.itemId} className="flex items-center gap-1">
              <span className="min-w-0 flex-1 truncate">
                {itemName(lookup(c.itemId), c.itemId)}
              </span>
              <IconButton
                label={t('contents.less', { name: itemName(lookup(c.itemId), c.itemId) })}
                icon={<Minus size={14} />}
                disabled={readOnly}
                onClick={() => setQty(c.itemId, c.qty - 1)}
              />
              <span className="w-6 text-center font-mono tabular-nums">{c.qty}</span>
              <IconButton
                label={t('contents.more', { name: itemName(lookup(c.itemId), c.itemId) })}
                icon={<Plus size={14} />}
                disabled={readOnly}
                onClick={() => setQty(c.itemId, c.qty + 1)}
              />
              <IconButton
                label={t('contents.remove', { name: itemName(lookup(c.itemId), c.itemId) })}
                icon={<Trash2 size={14} />}
                disabled={readOnly}
                onClick={() => setQty(c.itemId, 0)}
              />
            </li>
          ))}
        </ul>
        <div className="flex gap-1">
          <Select
            aria-label={t('contents.addItem')}
            className="min-w-0 flex-1"
            value={adding}
            disabled={readOnly}
            onValueChange={setAdding}
            options={[
              { value: '', label: t('contents.choose') },
              ...(
                [
                  ['device', devices],
                  ['blanking_cover', covers],
                  ['plate', plates],
                ] as const
              ).flatMap(([category, items]) =>
                items.map((i) => ({
                  value: i.id,
                  label: `${t(`catalog.categories.${category}`)} · ${itemName(i)}`,
                })),
              ),
            ]}
          />
          <Button
            disabled={readOnly || !adding}
            onClick={() => {
              const line = contents.find((c) => c.itemId === adding);
              setQty(adding, (line?.qty ?? 0) + 1);
              setAdding('');
            }}
          >
            {t('contents.add')}
          </Button>
        </div>

        {boxPresets.length > 0 ? (
          <div className="flex flex-col gap-1 border-t border-border pt-2">
            <span className="text-small text-text-muted">{t('contents.presets')}</span>
            <Select
              aria-label={t('contents.applyPreset')}
              value=""
              disabled={readOnly}
              onValueChange={(id) => {
                const preset = boxPresets.find((p) => p.id === id);
                if (preset) update('apply preset', (n) => applyPresetTo(n, preset));
              }}
              options={[
                { value: '', label: t('contents.applyPreset') },
                ...boxPresets.map((p) => ({ value: p.id, label: p.name })),
              ]}
            />
          </div>
        ) : null}
      </div>
    </PanelSection>
  );
}
