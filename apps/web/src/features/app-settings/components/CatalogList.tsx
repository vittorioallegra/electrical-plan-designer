import { MoreHorizontal, Plus } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router';
import type { Draft } from 'immer';
import { toEpc } from '@epd/domain/catalog/epc';
import {
  createProjectCatalog,
  replaceCatalog,
  usedItemIds,
  type IncomingCatalog,
} from '@epd/domain/catalog/replace';
import { builtinCatalog } from '@epd/domain/catalog/builtin';
import type { ProjectCatalog } from '@epd/domain/catalog/types';
import type { Library } from '@epd/domain/library';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { IconButton } from '@/components/ui/IconButton';
import { Menu } from '@/components/ui/Menu';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/lib/cn';
import { fileSafe } from '@/lib/download';
import { exportFilters, useExportFile } from '@/hooks/useExportFile';
import { useEditorServices } from '@/stores/editor/EditorContext';
import { useLibraryCatalog } from '../hooks/useLibraryCatalog';
import { ImportDialog } from './ImportDialog';
import { ReplaceDialog } from './ReplaceDialog';

/** Value of the `catalog` search parameter that filters the Catalog page to the built-ins. */
export const BUILTIN_FILTER = 'builtin';

type Importing =
  { mode: 'import' } | { mode: 'replace'; catalog: ProjectCatalog; incoming?: IncomingCatalog };

const row = 'flex h-7 items-center gap-2 rounded-sm px-2 text-body';

/**
 * The catalogs under Catalog in the Settings sidebar: a row each (a click filters the Catalog
 * page to it), with replace, export and remove on the imported ones, and the import action.
 */
export function CatalogList() {
  const { t } = useTranslation();
  const { library } = useEditorServices();
  const toast = useToast();
  const exportFile = useExportFile();
  const { catalogs, boxPresets } = useLibraryCatalog();
  const [params] = useSearchParams();
  const active = params.get('catalog');
  const [importing, setImporting] = useState<Importing | null>(null);
  const [removing, setRemoving] = useState<ProjectCatalog | null>(null);

  // In the library only box presets use items; a project keeps its own copies.
  const used = useMemo(
    () => usedItemIds({ nodes: [], segments: [], panels: [] }, boxPresets),
    [boxPresets],
  );
  const apply = (recipe: (d: Draft<Library>) => void) => library.getState().apply(recipe);

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

  const entry = (id: string, name: string, count: number, actions?: ReactNode) => (
    <li key={id} className="flex items-center">
      <Link
        to={`catalog?catalog=${encodeURIComponent(id)}`}
        aria-current={active === id ? 'true' : undefined}
        className={cn(
          row,
          'min-w-0 flex-1 pl-5',
          active === id
            ? 'bg-accent-subtle font-medium text-accent-text'
            : 'text-text-muted hover:bg-hover hover:text-text',
        )}
      >
        <span className="min-w-0 flex-1 truncate">{name}</span>
        <span className="font-mono text-small tabular-nums">{count}</span>
      </Link>
      {actions}
    </li>
  );

  return (
    <>
      <ul aria-label={t('catalog.catalogs')} className="flex flex-col gap-0.5">
        {entry(BUILTIN_FILTER, t('catalog.builtinCatalog'), builtinCatalog.length)}
        {catalogs.map((c) =>
          entry(
            c.id,
            c.name,
            c.items.length,
            <Menu
              trigger={
                <IconButton
                  label={t('catalog.catalogActions', { name: c.name })}
                  icon={<MoreHorizontal size={14} />}
                  className="ml-0.5"
                />
              }
              items={[
                {
                  key: 'replace',
                  label: t('catalog.replace.open'),
                  onSelect: () => setImporting({ mode: 'replace', catalog: c }),
                },
                {
                  key: 'export',
                  label: t('catalog.export'),
                  onSelect: () =>
                    void exportFile(
                      `${fileSafe(c.name)}.epc`,
                      new Blob([JSON.stringify(toEpc(c), null, 2)], { type: 'application/json' }),
                      exportFilters.catalog,
                    ),
                },
                {
                  key: 'remove',
                  label: t('catalog.remove'),
                  danger: true,
                  separatorBefore: true,
                  onSelect: () => askRemove(c),
                },
              ]}
            />,
          ),
        )}
      </ul>
      <button
        type="button"
        className={cn(row, 'pl-5 text-text-muted hover:bg-hover hover:text-text')}
        onClick={() => setImporting({ mode: 'import' })}
      >
        <Plus size={14} aria-hidden />
        {t('catalog.import.open')}
      </button>

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
    </>
  );
}
