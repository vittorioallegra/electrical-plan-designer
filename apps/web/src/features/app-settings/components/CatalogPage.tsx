import { Plus, Search } from 'lucide-react';
import { useDeferredValue, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';
import type { Draft } from 'immer';
import { catalogItemId } from '@epd/domain/catalog/replace';
import { isBuiltin, type CatalogCategory, type CatalogItem } from '@epd/domain/catalog/types';
import type { Library } from '@epd/domain/library';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Table, type Column } from '@/components/ui/Table';
import { fieldBox } from '@/components/ui/TextField';
import { useItemName } from '@/hooks/useItemName';
import { cn } from '@/lib/cn';
import { formatMoney } from '@/lib/format';
import { useEditorServices } from '@/stores/editor/EditorContext';
import { useLibraryCatalog } from '../hooks/useLibraryCatalog';
import { BUILTIN_FILTER } from './CatalogList';
import { categories, ItemDialog, type ItemDraft } from './ItemDialog';
import { ItemDetail, type ItemEdit } from './ItemDetail';
import { PageHeader } from './PageHeader';

/** Catalog that holds the items created or duplicated by hand. */
export const OWN_CATALOG_ID = 'own';

type Editing = {
  title: string;
  initial: Partial<CatalogItem> & { category: CatalogCategory };
};

/** `/settings/catalog`: the items of the built-ins and the imported catalogs, and the selected one. */
export function CatalogPage() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'it' ? 'it' : 'en';
  const { library } = useEditorServices();
  const { items, catalogs, priceOverrides } = useLibraryCatalog();
  const itemName = useItemName();
  const [params] = useSearchParams();
  const catalogFilter = params.get('catalog');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<CatalogCategory | 'all'>('all');
  const [showArchived, setShowArchived] = useState(false);
  const [onlyUnpriced, setOnlyUnpriced] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Editing | null>(null);

  const catalogOf = useMemo(
    () => new Map(catalogs.flatMap((c) => c.items.map((i) => [i.id, c] as const))),
    [catalogs],
  );
  const catalogName = (item: CatalogItem) =>
    isBuiltin(item) ? t('catalog.builtinBadge') : (catalogOf.get(item.id)?.name ?? '');

  // The price an item has in the library: a built-in's is an override.
  const priceOf = useMemo(
    () => (item: CatalogItem) =>
      isBuiltin(item) ? priceOverrides[item.id]?.unitPrice : item.unitPrice,
    [priceOverrides],
  );

  // Items of the chosen catalog, archived ones only on request: the base of the count below.
  const inCatalog = useMemo(
    () =>
      items.filter((i) => {
        if (i.archived && !showArchived) return false;
        if (!catalogFilter) return true;
        return catalogFilter === BUILTIN_FILTER
          ? isBuiltin(i)
          : catalogOf.get(i.id)?.id === catalogFilter;
      }),
    [items, showArchived, catalogFilter, catalogOf],
  );
  const unpriced = useMemo(
    () => inCatalog.filter((i) => priceOf(i) === undefined).length,
    [inCatalog, priceOf],
  );
  const needle = useDeferredValue(query).trim().toLowerCase();
  const visible = useMemo(
    () =>
      inCatalog.filter((i) => {
        if (category !== 'all' && i.category !== category) return false;
        if (onlyUnpriced && priceOf(i) !== undefined) return false;
        if (!needle) return true;
        return (
          itemName(i).toLowerCase().includes(needle) ||
          (i.code ?? '').toLowerCase().includes(needle)
        );
      }),
    [inCatalog, category, onlyUnpriced, needle, priceOf, itemName],
  );
  const selected = visible.find((i) => i.id === selectedId) ?? null;

  const apply = (recipe: (d: Draft<Library>) => void) => library.getState().apply(recipe);

  function saveNewItem(item: ItemDraft) {
    const now = new Date().toISOString();
    let newItemId = '';
    apply((d) => {
      let own = d.catalogs.find((c) => c.id === OWN_CATALOG_ID);
      if (!own) {
        own = { id: OWN_CATALOG_ID, name: t('catalog.myItems'), importedAt: now, items: [] };
        d.catalogs.push(own);
      }
      const taken = new Set(own.items.map((i) => i.id));
      newItemId = catalogItemId(OWN_CATALOG_ID, item.code);
      while (taken.has(newItemId)) newItemId = catalogItemId(OWN_CATALOG_ID, undefined);
      own.items.push({ ...item, id: newItemId });
    });
    setEditing(null);
    setSelectedId(newItemId);
  }

  function editItem(id: string, edit: ItemEdit) {
    apply((d) => {
      for (const c of d.catalogs) {
        const item = c.items.find((i) => i.id === id);
        if (!item) continue;
        if (edit.field === 'attribute') {
          const attributes: Record<string, unknown> = { ...item.attributes };
          if (edit.value === null || edit.value === undefined) delete attributes[edit.key];
          else attributes[edit.key] = edit.value;
          item.attributes = attributes as typeof item.attributes;
          const { rails, modulesPerRail } = item.attributes;
          if (item.category === 'enclosure' && rails && modulesPerRail)
            item.modules = rails * modulesPerRail;
        } else if (edit.field === 'unitPrice') {
          item.unitPrice = Math.round(edit.value * 100);
        } else if (edit.field === 'modules') {
          item.modules = edit.value;
        } else if (edit.field === 'code' && edit.value === '') {
          delete item.code;
        } else if (edit.field === 'code') {
          item.code = edit.value;
        } else {
          item.name = edit.value;
        }
        item.editedAt = new Date().toISOString();
      }
    });
  }

  function setArchived(id: string, archived: boolean) {
    apply((d) => {
      for (const c of d.catalogs) {
        const found = c.items.find((i) => i.id === id);
        if (found) found.archived = archived;
      }
    });
  }

  function setPrice(item: CatalogItem, euros: number) {
    if (!isBuiltin(item)) {
      editItem(item.id, { field: 'unitPrice', value: euros });
      return;
    }
    apply((d) => {
      d.priceOverrides[item.id] = {
        ...d.priceOverrides[item.id],
        unitPrice: Math.round(euros * 100),
      };
    });
  }

  function duplicate(item: CatalogItem) {
    const { id: _id, editedAt: _e, missing: _m, archived: _a, ...copy } = item;
    setEditing({
      title: t('catalog.duplicateTitle'),
      initial: { ...copy, name: t('catalog.copyOf', { name: itemName(item) }) },
    });
  }

  const columns: Column<CatalogItem>[] = [
    {
      key: 'name',
      header: t('catalog.name'),
      cell: (item) => (
        <span className={cn('flex items-center gap-2', item.archived && 'opacity-50')}>
          <span className="truncate">{itemName(item)}</span>
          {item.archived ? <Badge>{t('catalog.archivedBadge')}</Badge> : null}
          {item.missing ? <Badge tone="warning">{t('catalog.missingBadge')}</Badge> : null}
        </span>
      ),
    },
    {
      key: 'catalog',
      className: 'max-[1180px]:hidden',
      header: t('catalog.catalogColumn'),
      cell: (item) => <span className="text-text-muted">{catalogName(item)}</span>,
    },
    {
      key: 'code',
      header: t('catalog.code'),
      cell: (item) => <span className="font-mono text-text-muted">{item.code}</span>,
    },
    {
      key: 'modules',
      header: t('catalog.modules'),
      align: 'right',
      cell: (item) => item.modules ?? <span className="text-text-faint">—</span>,
    },
    {
      key: 'price',
      header: t('catalog.priceLabel'),
      align: 'right',
      cell: (item) => {
        const price = priceOf(item);
        return price !== undefined ? (
          formatMoney(price, locale)
        ) : (
          <span className="text-text-faint" aria-label={t('catalog.unpriced')}>
            —
          </span>
        );
      },
    },
  ];

  return (
    <div className="flex h-full min-h-0">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="px-5 pt-4 pb-3">
          <PageHeader
            title={t('pages.catalog')}
            hint={t('catalog.hint')}
            actions={
              <Button
                variant="primary"
                onClick={() =>
                  setEditing({
                    title: t('catalog.newItem'),
                    initial: { category: category === 'all' ? 'device' : category },
                  })
                }
              >
                <Plus size={14} aria-hidden />
                {t('catalog.newItem')}
              </Button>
            }
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 px-5 pb-3">
          <span className={cn(fieldBox, 'flex w-72 items-center gap-2 border-border')}>
            <Search size={14} className="text-text-faint" aria-hidden />
            <input
              type="text"
              aria-label={t('catalog.search')}
              placeholder={t('catalog.search')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="min-w-0 flex-1 bg-transparent outline-none"
            />
          </span>
          <SegmentedControl
            aria-label={t('catalog.category')}
            className="max-w-full flex-wrap"
            value={category}
            onValueChange={(v) => setCategory(v as CatalogCategory | 'all')}
            options={[
              { value: 'all', label: t('catalog.allCategories') },
              ...categories.map((c) => ({ value: c, label: t(`catalog.categories.${c}`) })),
            ]}
          />
          <label className="ml-auto flex items-center gap-2 text-text-muted">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
            />
            {t('catalog.showArchived')}
          </label>
          {unpriced > 0 || onlyUnpriced ? (
            <button
              type="button"
              aria-pressed={onlyUnpriced}
              onClick={() => setOnlyUnpriced((v) => !v)}
              className="rounded-xs focus-visible:outline-2"
            >
              <Badge
                tone={onlyUnpriced ? 'accent' : 'warning'}
                className={cn(
                  'h-6 cursor-pointer px-2 text-small',
                  onlyUnpriced && 'ring-1 ring-accent',
                )}
              >
                {t('catalog.withoutPrice', { count: unpriced })}
              </Badge>
            </button>
          ) : null}
        </div>
        <div className="min-h-0 flex-1 overflow-auto border-t border-border">
          <Table
            columns={columns}
            rows={visible}
            rowKey={(i) => i.id}
            selectedKey={selected?.id ?? null}
            onRowClick={(i) => setSelectedId(i.id)}
            empty={<EmptyState message={t('catalog.noResults')} />}
          />
        </div>
      </div>
      <aside
        aria-label={t('catalog.detail')}
        className="w-80 flex-none overflow-hidden border-l border-border bg-panel max-[1180px]:w-64"
      >
        {selected ? (
          <ItemDetail
            key={selected.id}
            item={selected}
            catalogName={catalogName(selected)}
            price={priceOf(selected)}
            onPrice={(euros) => setPrice(selected, euros)}
            onEdit={(edit) => editItem(selected.id, edit)}
            onDuplicate={() => duplicate(selected)}
            onArchive={(archived) => setArchived(selected.id, archived)}
          />
        ) : (
          <EmptyState
            message={selectedId ? t('catalog.selectionHidden') : t('catalog.selectItem')}
          />
        )}
      </aside>

      {editing ? (
        <ItemDialog
          title={editing.title}
          initial={editing.initial}
          onClose={() => setEditing(null)}
          onSave={saveNewItem}
        />
      ) : null}
    </div>
  );
}
