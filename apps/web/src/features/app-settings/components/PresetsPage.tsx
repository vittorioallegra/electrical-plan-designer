import { Minus, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { newId } from '@epd/domain/ids';
import type { BoxPreset } from '@epd/domain/types';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { TextField } from '@/components/ui/TextField';
import { useItemName } from '@/hooks/useItemName';
import { useEditorServices } from '@/stores/editor/EditorContext';
import { useLibraryCatalog } from '../hooks/useLibraryCatalog';

const contentCategories = ['device', 'blanking_cover', 'plate'] as const;

/** `/settings/presets`: box presets (a box with its contents) that boxes can be placed with. */
export function PresetsPage() {
  const { t } = useTranslation();
  const { library } = useEditorServices();
  const { boxPresets } = useLibraryCatalog();
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<BoxPreset | null>(null);
  const [name, setName] = useState('');

  const edit = (id: string, fn: (p: BoxPreset) => void) =>
    library.getState().apply((d) => {
      const preset = d.boxPresets.find((p) => p.id === id);
      if (preset) fn(preset);
    });

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">{t('pages.presets')}</h1>
        <Button
          variant="primary"
          onClick={() => {
            setName('');
            setCreating(true);
          }}
        >
          {t('library.presets.new')}
        </Button>
      </div>
      <p className="text-text-muted">{t('library.presets.hint')}</p>
      {boxPresets.length === 0 ? (
        <p className="text-text-muted">{t('library.presets.empty')}</p>
      ) : null}
      {boxPresets.map((preset) => (
        <PresetCard
          key={preset.id}
          preset={preset}
          edit={(fn) => edit(preset.id, fn)}
          onDelete={() => setDeleting(preset)}
        />
      ))}

      <Dialog open={creating} onOpenChange={setCreating} title={t('library.presets.newTitle')}>
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            const trimmed = name.trim();
            if (!trimmed) return;
            library.getState().apply((d) => {
              d.boxPresets.push({ id: newId(), name: trimmed, contents: [] });
            });
            setCreating(false);
          }}
        >
          <TextField
            label={t('contents.presetName')}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button type="button" onClick={() => setCreating(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" variant="primary">
              {t('library.presets.create')}
            </Button>
          </div>
        </form>
      </Dialog>
      <Dialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={t('library.presets.deleteTitle', { name: deleting?.name ?? '' })}
        description={t('library.presets.deleteBody')}
        footer={
          <>
            <Button onClick={() => setDeleting(null)}>{t('common.cancel')}</Button>
            <Button
              variant="danger-ghost"
              onClick={() => {
                const id = deleting?.id;
                setDeleting(null);
                library.getState().apply((d) => {
                  d.boxPresets = d.boxPresets.filter((p) => p.id !== id);
                });
              }}
            >
              {t('library.presets.delete')}
            </Button>
          </>
        }
      />
    </div>
  );
}

function PresetCard({
  preset,
  edit,
  onDelete,
}: {
  preset: BoxPreset;
  edit: (fn: (p: BoxPreset) => void) => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const { items, lookup } = useLibraryCatalog();
  const itemName = useItemName();
  const [adding, setAdding] = useState('');
  const available = (category: string) =>
    items.filter((i) => i.category === category && !i.archived && !i.missing);
  // The preset's own box stays selectable even when it was archived since.
  const boxes = available('box');
  const ownBox = preset.boxItemId ? lookup(preset.boxItemId) : undefined;
  if (ownBox && !boxes.includes(ownBox)) boxes.push(ownBox);

  const setQty = (itemId: string, qty: number) =>
    edit((p) => {
      const line = p.contents.find((c) => c.itemId === itemId);
      if (qty <= 0) p.contents = p.contents.filter((c) => c.itemId !== itemId);
      else if (line) line.qty = qty;
      else p.contents.push({ itemId, qty });
    });

  return (
    <section
      aria-label={preset.name}
      className="flex flex-col gap-2 rounded border border-border p-3"
    >
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <TextField
            key={preset.name}
            label={t('contents.presetName')}
            defaultValue={preset.name}
            onBlur={(e) => {
              const value = e.target.value.trim();
              if (value && value !== preset.name) edit((p) => void (p.name = value));
            }}
          />
        </div>
        <Button variant="ghost" onClick={onDelete}>
          {t('library.presets.delete')}
        </Button>
      </div>
      <label className="flex items-center gap-2">
        <span className="w-24">{t('library.presets.box')}</span>
        <select
          className="h-[var(--control-height)] min-w-0 flex-1 rounded border border-border px-1"
          value={preset.boxItemId ?? ''}
          onChange={(e) =>
            edit((p) => {
              if (e.target.value) p.boxItemId = e.target.value;
              else delete p.boxItemId;
            })
          }
        >
          <option value="">{t('contents.plainBox')}</option>
          {boxes.map((i) => (
            <option key={i.id} value={i.id}>
              {itemName(i)}
            </option>
          ))}
        </select>
      </label>
      {preset.contents.length === 0 ? (
        <p className="text-text-muted">{t('contents.empty')}</p>
      ) : null}
      <ul className="flex flex-col gap-1">
        {preset.contents.map((c) => {
          const name = itemName(lookup(c.itemId), c.itemId);
          return (
            <li key={c.itemId} className="flex items-center gap-1">
              <span className="min-w-0 flex-1 truncate">{name}</span>
              <Button
                variant="ghost"
                aria-label={t('contents.less', { name })}
                onClick={() => setQty(c.itemId, c.qty - 1)}
              >
                <Minus size={14} />
              </Button>
              <span className="w-6 text-center tabular-nums">{c.qty}</span>
              <Button
                variant="ghost"
                aria-label={t('contents.more', { name })}
                onClick={() => setQty(c.itemId, c.qty + 1)}
              >
                <Plus size={14} />
              </Button>
              <Button
                variant="ghost"
                aria-label={t('contents.remove', { name })}
                onClick={() => setQty(c.itemId, 0)}
              >
                <Trash2 size={14} />
              </Button>
            </li>
          );
        })}
      </ul>
      <div className="flex gap-1">
        <select
          aria-label={t('contents.addItem')}
          className="h-[var(--control-height)] min-w-0 flex-1 rounded border border-border px-1"
          value={adding}
          onChange={(e) => setAdding(e.target.value)}
        >
          <option value="">{t('contents.choose')}</option>
          {contentCategories.map((category) => (
            <optgroup key={category} label={t(`catalog.categories.${category}`)}>
              {available(category).map((i) => (
                <option key={i.id} value={i.id}>
                  {itemName(i)}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <Button
          disabled={!adding}
          onClick={() => {
            const line = preset.contents.find((c) => c.itemId === adding);
            setQty(adding, (line?.qty ?? 0) + 1);
            setAdding('');
          }}
        >
          {t('contents.add')}
        </Button>
      </div>
    </section>
  );
}
