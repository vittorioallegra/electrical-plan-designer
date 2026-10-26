import { Archive, ArchiveRestore, Copy, Pencil } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { isBuiltin, type CatalogCategory, type CatalogItem } from '@epd/domain/catalog/types';
import { Button } from '@/components/ui/Button';
import { formatMoney } from '@/lib/format';
import { NumberInput } from '@/components/ui/NumberInput';
import { cn } from '@/lib/cn';
import { useToast } from '@/components/ui/Toast';
import { categories, ItemDialog } from './ItemDialog';
import { useCatalog, useCreateCatalogItem, useUpdateCatalogItem } from '@/api/catalog';
import type { NewCatalogItem } from '@/lib/repositories/types';
import { useItemName } from '@/hooks/useItemName';

type Editing = {
  title: string;
  initial: Partial<CatalogItem> & { category: CatalogCategory };
  id?: string;
};

export function CatalogPage() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'it' ? 'it' : 'en';
  const { items, profile, updateProfile } = useCatalog();
  const createItem = useCreateCatalogItem();
  const updateItem = useUpdateCatalogItem();
  const itemName = useItemName();
  const toast = useToast();
  const [category, setCategory] = useState<CatalogCategory>('device');
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<Editing | null>(null);

  const visible = useMemo(
    () => items.filter((i) => i.category === category && (showArchived || !i.archived)),
    [items, category, showArchived],
  );

  async function save(item: NewCatalogItem) {
    try {
      if (editing?.id) await updateItem.mutateAsync({ id: editing.id, patch: item });
      else await createItem.mutateAsync(item);
      setEditing(null);
    } catch {
      toast(t('catalog.saveFailed'), 'error');
    }
  }

  async function setArchived(item: CatalogItem, archived: boolean) {
    try {
      await updateItem.mutateAsync({ id: item.id, patch: { archived } });
    } catch {
      toast(t('catalog.saveFailed'), 'error');
    }
  }

  async function setOverride(itemId: string, euros: number | null) {
    if (!profile) return;
    const next = { ...profile.priceOverrides };
    if (euros === null) delete next[itemId];
    else next[itemId] = { ...next[itemId], unitPrice: Math.round(euros * 100) };
    try {
      await updateProfile({ priceOverrides: next });
    } catch {
      toast(t('catalog.saveFailed'), 'error');
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">{t('pages.catalog')}</h1>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
            />
            {t('catalog.showArchived')}
          </label>
          <Button
            variant="primary"
            onClick={() => setEditing({ title: t('catalog.newItem'), initial: { category } })}
          >
            {t('catalog.newItem')}
          </Button>
        </div>
      </div>
      <p className="mb-3 text-text-muted">{t('catalog.hint')}</p>
      <div role="tablist" aria-label={t('catalog.category')} className="mb-3 flex flex-wrap gap-1">
        {categories.map((c) => (
          <button
            key={c}
            role="tab"
            aria-selected={c === category}
            className={cn(
              'rounded px-2 py-1',
              c === category ? 'bg-accent text-accent-contrast' : 'bg-surface-muted',
            )}
            onClick={() => setCategory(c)}
          >
            {t(`catalog.categories.${c}`)}
          </button>
        ))}
      </div>
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-border text-text-muted">
            <th className="px-2 py-1 font-medium">{t('catalog.name')}</th>
            <th className="px-2 py-1 font-medium">{t('catalog.code')}</th>
            <th className="px-2 py-1 font-medium">{t('catalog.modules')}</th>
            <th className="px-2 py-1 text-right font-medium">{t('catalog.priceLabel')}</th>
            <th className="px-2 py-1">
              <span className="sr-only">{t('catalog.actions')}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {visible.map((item) => {
            const builtin = isBuiltin(item);
            const override = profile?.priceOverrides[item.id]?.unitPrice;
            return (
              <tr
                key={item.id}
                className={cn('border-b border-border/60', item.archived && 'opacity-50')}
              >
                <td className="px-2 py-1">
                  {itemName(item)}
                  {builtin ? (
                    <span className="ml-2 text-xs text-text-muted">
                      {t('catalog.builtinBadge')}
                    </span>
                  ) : null}
                  {item.archived ? (
                    <span className="ml-2 text-xs text-text-muted">
                      {t('catalog.archivedBadge')}
                    </span>
                  ) : null}
                </td>
                <td className="px-2 py-1 text-text-muted">{item.code}</td>
                <td className="px-2 py-1 tabular-nums">{item.modules}</td>
                <td className="px-2 py-1 text-right">
                  {builtin ? (
                    <NumberInput
                      aria-label={t('catalog.priceFor', { name: itemName(item) })}
                      className="w-36"
                      value={override !== undefined ? override / 100 : null}
                      placeholder={t('catalog.unpriced')}
                      unit="€"
                      min={0}
                      onValueChange={(v) => void setOverride(item.id, v)}
                    />
                  ) : item.unitPrice !== undefined ? (
                    <span className="tabular-nums">{formatMoney(item.unitPrice, locale)}</span>
                  ) : (
                    <span className="text-warning">{t('catalog.unpriced')}</span>
                  )}
                </td>
                <td className="px-2 py-1">
                  <div className="flex justify-end gap-1">
                    {!builtin ? (
                      <Button
                        variant="ghost"
                        aria-label={t('catalog.edit', { name: itemName(item) })}
                        onClick={() =>
                          setEditing({ title: t('catalog.editTitle'), initial: item, id: item.id })
                        }
                      >
                        <Pencil size={16} />
                      </Button>
                    ) : null}
                    <Button
                      variant="ghost"
                      aria-label={t('catalog.duplicate', { name: itemName(item) })}
                      onClick={() => {
                        const { id: _id, ...copy } = item;
                        setEditing({
                          title: t('catalog.duplicateTitle'),
                          initial: {
                            ...copy,
                            archived: false,
                            name: t('catalog.copyOf', { name: itemName(item) }),
                          },
                        });
                      }}
                    >
                      <Copy size={16} />
                    </Button>
                    {!builtin ? (
                      <Button
                        variant="ghost"
                        aria-label={t(item.archived ? 'catalog.restore' : 'catalog.archive', {
                          name: itemName(item),
                        })}
                        onClick={() => void setArchived(item, !item.archived)}
                      >
                        {item.archived ? <ArchiveRestore size={16} /> : <Archive size={16} />}
                      </Button>
                    ) : null}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {editing ? (
        <ItemDialog
          title={editing.title}
          initial={editing.initial}
          onClose={() => setEditing(null)}
          onSave={save}
        />
      ) : null}
    </div>
  );
}
