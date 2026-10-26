import { Minus, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { newId } from '@epd/domain/ids';
import type { PlanNode } from '@epd/domain/types';
import { useEditor, useEditorContext } from '@/stores/editor/EditorContext';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';
import { useToast } from '@/components/ui/Toast';
import { applyPresetTo } from '@/features/editor/utils/commands';
import { useCatalog } from '@/hooks/useCatalog';
import { useItemName } from '@/hooks/useItemName';
import { useItemsOf } from '@/hooks/useItemsOf';

/** Contents of a terminal box: devices, blanking covers and plate, with a modules counter. */
export function BoxContents({ node }: { node: PlanNode }) {
  const { t } = useTranslation();
  const { store } = useEditorContext();
  const readOnly = useEditor((s) => s.readOnly);
  const { lookup, boxPresets } = useCatalog();
  const itemName = useItemName();
  const toast = useToast();
  const devices = useItemsOf('device');
  const covers = useItemsOf('blanking_cover');
  const plates = useItemsOf('plate');
  const [adding, setAdding] = useState('');
  const [presetName, setPresetName] = useState<string | null>(null);

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

  function savePreset(name: string) {
    const preset = {
      id: newId(),
      name,
      ...(node.mounting ? { mounting: node.mounting } : {}),
      ...(node.boxItemId ? { boxItemId: node.boxItemId } : {}),
      contents: structuredClone(contents),
    };
    const result = store.getState().applyCommand('box preset', (d) => {
      d.boxPresets.push(preset);
    });
    if (result.ok) toast(t('contents.presetSaved', { name }), 'success');
    else toast(t('contents.presetFailed'), 'error');
  }

  return (
    <div className="flex flex-col gap-2 border-t border-border pt-2" data-testid="box-contents">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">{t('contents.title')}</h3>
        <span
          className={cn('tabular-nums', over ? 'font-medium text-error' : 'text-text-muted')}
          data-testid="modules-counter"
        >
          {box?.modules !== undefined
            ? t('contents.modules', { used, available: box.modules })
            : t('contents.modulesNoBox', { used })}
        </span>
      </div>
      {contents.length === 0 ? <p className="text-text-muted">{t('contents.empty')}</p> : null}
      <ul className="flex flex-col gap-1">
        {contents.map((c) => (
          <li key={c.itemId} className="flex items-center gap-1">
            <span className="min-w-0 flex-1 truncate">{itemName(lookup(c.itemId), c.itemId)}</span>
            <Button
              variant="ghost"
              aria-label={t('contents.less', { name: itemName(lookup(c.itemId), c.itemId) })}
              disabled={readOnly}
              onClick={() => setQty(c.itemId, c.qty - 1)}
            >
              <Minus size={14} />
            </Button>
            <span className="w-6 text-center tabular-nums">{c.qty}</span>
            <Button
              variant="ghost"
              aria-label={t('contents.more', { name: itemName(lookup(c.itemId), c.itemId) })}
              disabled={readOnly}
              onClick={() => setQty(c.itemId, c.qty + 1)}
            >
              <Plus size={14} />
            </Button>
            <Button
              variant="ghost"
              aria-label={t('contents.remove', { name: itemName(lookup(c.itemId), c.itemId) })}
              disabled={readOnly}
              onClick={() => setQty(c.itemId, 0)}
            >
              <Trash2 size={14} />
            </Button>
          </li>
        ))}
      </ul>
      <div className="flex gap-1">
        <select
          aria-label={t('contents.addItem')}
          className="h-[var(--control-height)] min-w-0 flex-1 rounded border border-border px-1"
          value={adding}
          disabled={readOnly}
          onChange={(e) => setAdding(e.target.value)}
        >
          <option value="">{t('contents.choose')}</option>
          {(
            [
              ['device', devices],
              ['blanking_cover', covers],
              ['plate', plates],
            ] as const
          ).map(([category, items]) => (
            <optgroup key={category} label={t(`catalog.categories.${category}`)}>
              {items.map((i) => (
                <option key={i.id} value={i.id}>
                  {itemName(i)}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
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

      <div className="flex flex-col gap-1 border-t border-border pt-2">
        <span>{t('contents.presets')}</span>
        {boxPresets.length > 0 ? (
          <select
            aria-label={t('contents.applyPreset')}
            className="h-[var(--control-height)] rounded border border-border px-1"
            value=""
            disabled={readOnly}
            onChange={(e) => {
              const preset = boxPresets.find((p) => p.id === e.target.value);
              if (preset) update('apply preset', (n) => applyPresetTo(n, preset));
            }}
          >
            <option value="">{t('contents.applyPreset')}</option>
            {boxPresets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        ) : null}
        {presetName === null ? (
          <Button disabled={readOnly} onClick={() => setPresetName('')}>
            {t('contents.savePreset')}
          </Button>
        ) : (
          <form
            className="flex gap-1"
            onSubmit={(e) => {
              e.preventDefault();
              if (presetName.trim()) savePreset(presetName.trim());
              setPresetName(null);
            }}
          >
            <input
              aria-label={t('contents.presetName')}
              autoFocus
              className="h-[var(--control-height)] min-w-0 flex-1 rounded border border-border px-2"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
            />
            <Button type="submit" variant="primary">
              {t('common.save')}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
