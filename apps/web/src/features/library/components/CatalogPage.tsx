import { Archive, ArchiveRestore, Copy, Pencil } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Draft } from 'immer';
import { isPriceOnly } from '@epd/domain/catalog/attributes';
import { toEpc } from '@epd/domain/catalog/epc';
import {
  catalogItemId,
  createProjectCatalog,
  replaceCatalog,
  usedItemIds,
  type IncomingCatalog,
} from '@epd/domain/catalog/replace';
import {
  isBuiltin,
  type CatalogCategory,
  type CatalogItem,
  type ProjectCatalog,
} from '@epd/domain/catalog/types';
import type { Library } from '@epd/domain/library';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { NumberInput } from '@/components/ui/NumberInput';
import { useToast } from '@/components/ui/Toast';
import { useItemName } from '@/hooks/useItemName';
import { cn } from '@/lib/cn';
import { fileSafe } from '@/lib/download';
import { exportFilters, useExportFile } from '@/hooks/useExportFile';
import { formatMoney } from '@/lib/format';
import { useEditorServices } from '@/stores/editor/EditorContext';
import { useLibraryCatalog } from '../hooks/useLibraryCatalog';
import { categories, ItemDialog, type ItemDraft } from './ItemDialog';
import { ImportDialog } from './ImportDialog';
import { ReplaceDialog } from './ReplaceDialog';

/** Catalog that holds the items created or duplicated by hand. */
export const OWN_CATALOG_ID = 'own';

type Editing = {
  title: string;
  initial: Partial<CatalogItem> & { category: CatalogCategory };
  id?: string;
};

type Importing =
  { mode: 'import' } | { mode: 'replace'; catalog: ProjectCatalog; incoming?: IncomingCatalog };

/** `/library/catalog`: the built-ins and the catalogs of the library. */
export function CatalogPage() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'it' ? 'it' : 'en';
  const { library } = useEditorServices();
  const toast = useToast();
  const exportFile = useExportFile();
  const { items, catalogs, priceOverrides, boxPresets } = useLibraryCatalog();
  const itemName = useItemName();
  const [category, setCategory] = useState<CatalogCategory>('device');
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [importing, setImporting] = useState<Importing | null>(null);
  const [removing, setRemoving] = useState<ProjectCatalog | null>(null);

  // In the library only box presets use items; a project keeps its own copies.
  const used = useMemo(
    () => usedItemIds({ nodes: [], segments: [], panels: [] }, boxPresets),
    [boxPresets],
  );
  const catalogOf = useMemo(
    () => new Map(catalogs.flatMap((c) => c.items.map((i) => [i.id, c] as const))),
    [catalogs],
  );
  const visible = useMemo(
    () => items.filter((i) => i.category === category && (showArchived || !i.archived)),
    [items, category, showArchived],
  );
  const dateFormat = new Intl.DateTimeFormat(locale === 'it' ? 'it-IT' : 'en-GB', {
    dateStyle: 'medium',
  });

  const apply = (recipe: (d: Draft<Library>) => void) => library.getState().apply(recipe);

  function saveItem(item: ItemDraft) {
    const id = editing?.id;
    const now = new Date().toISOString();
    apply((d) => {
      if (id) {
        for (const c of d.catalogs) {
          const index = c.items.findIndex((i) => i.id === id);
          if (index >= 0) c.items[index] = { ...item, id, editedAt: now };
        }
        return;
      }
      let own = d.catalogs.find((c) => c.id === OWN_CATALOG_ID);
      if (!own) {
        own = { id: OWN_CATALOG_ID, name: t('catalog.myItems'), importedAt: now, items: [] };
        d.catalogs.push(own);
      }
      const taken = new Set(own.items.map((i) => i.id));
      let newItemId = catalogItemId(OWN_CATALOG_ID, item.code);
      while (taken.has(newItemId)) newItemId = catalogItemId(OWN_CATALOG_ID, undefined);
      own.items.push({ ...item, id: newItemId });
    });
    setEditing(null);
  }

  function setArchived(item: CatalogItem, archived: boolean) {
    apply((d) => {
      for (const c of d.catalogs) {
        const found = c.items.find((i) => i.id === item.id);
        if (found) found.archived = archived;
      }
    });
  }

  function setOverride(itemId: string, euros: number | null) {
    apply((d) => {
      if (euros === null) delete d.priceOverrides[itemId];
      else
        d.priceOverrides[itemId] = {
          ...d.priceOverrides[itemId],
          unitPrice: Math.round(euros * 100),
        };
    });
  }

  function importCatalog(incoming: IncomingCatalog) {
    apply((d) => {
      d.catalogs.push(createProjectCatalog(incoming, new Date()));
    });
    setImporting(null);
    toast(
      t('catalog.import.done', { name: incoming.name, count: incoming.items.length }),
      'success',
    );
  }

  function replace(current: ProjectCatalog, incoming: IncomingCatalog, keep: ReadonlySet<string>) {
    const next = replaceCatalog(current, incoming, used, { keepEdited: keep }, new Date());
    apply((d) => {
      const index = d.catalogs.findIndex((c) => c.id === current.id);
      if (index >= 0) d.catalogs[index] = next;
    });
    setImporting(null);
    toast(t('catalog.replace.done', { name: next.name }), 'success');
  }

  function askRemove(catalog: ProjectCatalog) {
    const inUse = catalog.items.filter((i) => used.has(i.id)).length;
    if (inUse > 0) toast(t('catalog.removeInUse', { name: catalog.name, count: inUse }), 'error');
    else setRemoving(catalog);
  }

  return (
    <div className="mx-auto h-full max-w-5xl overflow-y-auto p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">{t('pages.catalog')}</h1>
        <Button variant="primary" onClick={() => setImporting({ mode: 'import' })}>
          {t('catalog.import.open')}
        </Button>
      </div>
      <p className="mb-3 text-text-muted">{t('catalog.hint')}</p>

      <section aria-label={t('catalog.catalogs')} className="mb-4">
        <ul className="divide-y divide-border rounded border border-border">
          <li className="flex items-center gap-3 px-3 py-2">
            <span className="flex-1 font-medium">{t('catalog.builtinCatalog')}</span>
          </li>
          {catalogs.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-3 px-3 py-2">
              <div className="min-w-0 flex-1">
                <span className="block truncate font-medium">{c.name}</span>
                <span className="block truncate text-text-muted">
                  {t('catalog.catalogInfo', {
                    count: c.items.length,
                    date: dateFormat.format(new Date(c.importedAt)),
                  })}
                  {c.source ? ` · ${c.source}` : ''}
                </span>
              </div>
              <Button variant="ghost" onClick={() => setImporting({ mode: 'replace', catalog: c })}>
                {t('catalog.replace.open')}
              </Button>
              <Button
                variant="ghost"
                onClick={() =>
                  void exportFile(
                    `${fileSafe(c.name)}.epc`,
                    new Blob([JSON.stringify(toEpc(c), null, 2)], { type: 'application/json' }),
                    exportFilters.catalog,
                  )
                }
              >
                {t('catalog.export')}
              </Button>
              <Button variant="ghost" onClick={() => askRemove(c)}>
                {t('catalog.remove')}
              </Button>
            </li>
          ))}
        </ul>
      </section>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div role="tablist" aria-label={t('catalog.category')} className="flex flex-wrap gap-1">
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
            onClick={() => setEditing({ title: t('catalog.newItem'), initial: { category } })}
          >
            {t('catalog.newItem')}
          </Button>
        </div>
      </div>
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-border text-text-muted">
            <th className="px-2 py-1 font-medium">{t('catalog.name')}</th>
            <th className="px-2 py-1 font-medium">{t('catalog.catalogColumn')}</th>
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
            const override = priceOverrides[item.id]?.unitPrice;
            const name = itemName(item);
            return (
              <tr
                key={item.id}
                data-item={item.id}
                className={cn('border-b border-border/60', item.archived && 'opacity-50')}
              >
                <td className="px-2 py-1">
                  {name}
                  {item.archived ? (
                    <Badge className="ml-2">{t('catalog.archivedBadge')}</Badge>
                  ) : null}
                  {item.missing ? (
                    <Badge tone="warning" className="ml-2">
                      {t('catalog.missingBadge')}
                    </Badge>
                  ) : !builtin && isPriceOnly(item) ? (
                    <Badge tone="warning" className="ml-2">
                      {t('catalog.priceOnlyBadge')}
                    </Badge>
                  ) : null}
                </td>
                <td className="px-2 py-1 text-text-muted">
                  {builtin ? t('catalog.builtinBadge') : catalogOf.get(item.id)?.name}
                </td>
                <td className="px-2 py-1 text-text-muted">{item.code}</td>
                <td className="px-2 py-1 tabular-nums">{item.modules}</td>
                <td className="px-2 py-1 text-right">
                  {builtin ? (
                    <NumberInput
                      aria-label={t('catalog.priceFor', { name })}
                      className="w-36"
                      value={override !== undefined ? override / 100 : null}
                      placeholder={t('catalog.unpriced')}
                      unit="€"
                      min={0}
                      onValueChange={(v) => setOverride(item.id, v)}
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
                        aria-label={t('catalog.edit', { name })}
                        onClick={() =>
                          setEditing({ title: t('catalog.editTitle'), initial: item, id: item.id })
                        }
                      >
                        <Pencil size={16} />
                      </Button>
                    ) : null}
                    <Button
                      variant="ghost"
                      aria-label={t('catalog.duplicate', { name })}
                      onClick={() => {
                        const { id: _id, editedAt: _e, missing: _m, archived: _a, ...copy } = item;
                        setEditing({
                          title: t('catalog.duplicateTitle'),
                          initial: { ...copy, name: t('catalog.copyOf', { name }) },
                        });
                      }}
                    >
                      <Copy size={16} />
                    </Button>
                    {!builtin ? (
                      <Button
                        variant="ghost"
                        aria-label={t(item.archived ? 'catalog.restore' : 'catalog.archive', {
                          name,
                        })}
                        onClick={() => setArchived(item, !item.archived)}
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
          onSave={saveItem}
        />
      ) : null}
      {importing?.mode === 'import' ? (
        <ImportDialog
          title={t('catalog.import.title')}
          onClose={() => setImporting(null)}
          onImport={importCatalog}
        />
      ) : null}
      {importing?.mode === 'replace' && !importing.incoming ? (
        <ImportDialog
          title={t('catalog.replace.title', { name: importing.catalog.name })}
          initialName={importing.catalog.name}
          onClose={() => setImporting(null)}
          onImport={(incoming) => setImporting({ ...importing, incoming })}
        />
      ) : null}
      {importing?.mode === 'replace' && importing.incoming ? (
        <ReplaceDialog
          catalog={importing.catalog}
          incoming={importing.incoming}
          used={used}
          onClose={() => setImporting(null)}
          onReplace={(keep) => replace(importing.catalog, importing.incoming!, keep)}
        />
      ) : null}
      <Dialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={t('catalog.removeTitle', { name: removing?.name ?? '' })}
        description={t('catalog.removeBody')}
        footer={
          <>
            <Button onClick={() => setRemoving(null)}>{t('common.cancel')}</Button>
            <Button
              variant="danger-ghost"
              onClick={() => {
                const id = removing?.id;
                setRemoving(null);
                apply((d) => {
                  d.catalogs = d.catalogs.filter((c) => c.id !== id);
                });
              }}
            >
              {t('catalog.remove')}
            </Button>
          </>
        }
      />
    </div>
  );
}
