import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  applyCatalogUpdate,
  catalogUpdateDiff,
  createLibrarySource,
  type CatalogUpdate,
} from '@epd/domain/catalog/copies';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { useToast } from '@/components/ui/Toast';
import { useItemName } from '@/hooks/useItemName';
import { formatMoney, formatNumber } from '@/lib/format';
import { useEditorContext } from '@/stores/editor/EditorContext';
import { useLibrary } from '@/stores/library/useLibrary';

const MAX_LISTED = 100;

/**
 * Whether an entry starts ticked. Overwriting a price the project already has starts unticked:
 * it may be a price typed in the quote, which a library update should not replace by accident.
 */
function startsTicked(update: CatalogUpdate): boolean {
  if (update.kind === 'cable') return update.before === undefined;
  return !update.priceChanged || update.before?.unitPrice === undefined;
}

/**
 * "Update catalog from library": the project's copies of items and cable prices next to the
 * library's, to tick and apply as one undoable command. Items the library no longer has stay
 * as they are.
 */
export function UpdateFromCatalogDialog({ onClose }: { onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'it' ? 'it' : 'en';
  const { store } = useEditorContext();
  const toast = useToast();
  const itemName = useItemName();
  const library = useLibrary((s) => s.library);
  const source = useMemo(() => createLibrarySource(library), [library]);
  // Read once on open: the list does not move under the user's ticks.
  const [diff] = useState(() => catalogUpdateDiff(store.getState().data, source));
  const [ticked, setTicked] = useState<ReadonlySet<string>>(
    () => new Set(diff.updates.filter(startsTicked).map((u) => u.key)),
  );
  const money = (cents: number | undefined) =>
    cents === undefined ? '—' : formatMoney(cents, locale);
  const nameOf = (u: CatalogUpdate) =>
    u.kind === 'cable'
      ? t('bom.cableLine', {
          section: formatNumber(u.crossSection, locale),
          color: t(`colors.${u.color}`),
        })
      : itemName(u.after);

  function toggle(key: string, on: boolean) {
    const next = new Set(ticked);
    if (on) next.add(key);
    else next.delete(key);
    setTicked(next);
  }

  function apply() {
    const result = store.getState().applyCommand('update catalog', (d) => {
      applyCatalogUpdate(d, source, ticked);
    });
    if (result.ok) toast(t('library.update.done', { count: ticked.size }), 'success');
    else toast(t('library.update.failed'), 'error');
    onClose();
  }

  const upToDate = diff.updates.length === 0 && diff.missing.length === 0;
  return (
    <Dialog
      open
      wide
      onOpenChange={(o) => !o && onClose()}
      title={t('library.update.title')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {upToDate ? t('library.update.close') : t('common.cancel')}
          </Button>
          {diff.updates.length > 0 ? (
            <Button variant="primary" disabled={ticked.size === 0} onClick={apply}>
              {t('library.update.apply', { count: ticked.size })}
            </Button>
          ) : null}
        </>
      }
    >
      <div className="flex max-h-[60vh] flex-col gap-3 overflow-y-auto" data-testid="update-diff">
        {upToDate ? <p>{t('library.update.upToDate')}</p> : <p>{t('library.update.hint')}</p>}
        {diff.updates.length > 0 ? (
          <section aria-label={t('library.update.differences')}>
            <div className="mb-1 flex items-center justify-between">
              <h3 className="font-medium">{t('library.update.differences')}</h3>
              <Button
                variant="ghost"
                onClick={() =>
                  setTicked(
                    ticked.size === diff.updates.length
                      ? new Set()
                      : new Set(diff.updates.map((u) => u.key)),
                  )
                }
              >
                {ticked.size === diff.updates.length
                  ? t('library.update.selectNone')
                  : t('library.update.selectAll')}
              </Button>
            </div>
            <table className="w-full">
              <thead>
                <tr className="text-left text-text-muted">
                  <th className="w-6" />
                  <th className="py-0.5 pr-2 font-normal">{t('library.update.item')}</th>
                  <th className="py-0.5 pr-2 text-right font-normal">
                    {t('library.update.projectPrice')}
                  </th>
                  <th className="py-0.5 text-right font-normal">
                    {t('library.update.libraryPrice')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {diff.updates.slice(0, MAX_LISTED).map((u) => {
                  const name = nameOf(u);
                  const fields =
                    u.kind === 'item'
                      ? [...new Set(u.changedFields.map((f) => f.split('.')[0]!))]
                      : [];
                  const before = u.before?.unitPrice;
                  const after = u.after?.unitPrice;
                  return (
                    <tr key={u.key} className="border-b border-border/60 align-top">
                      <td className="py-0.5">
                        <input
                          type="checkbox"
                          aria-label={t('library.update.take', { name })}
                          checked={ticked.has(u.key)}
                          onChange={(e) => toggle(u.key, e.target.checked)}
                        />
                      </td>
                      <td className="py-0.5 pr-2">
                        {name}
                        {u.kind === 'item' && u.before === undefined ? (
                          <span className="block text-text-muted">
                            {t('library.update.notCopied')}
                          </span>
                        ) : null}
                        {fields.length > 0 ? (
                          <span className="block text-text-muted">
                            {t('library.update.alsoChanged', {
                              fields: fields.map((f) => t(`library.update.fields.${f}`)).join(', '),
                            })}
                          </span>
                        ) : null}
                      </td>
                      <td className="py-0.5 pr-2 text-right tabular-nums whitespace-nowrap">
                        {money(before)}
                      </td>
                      <td className="py-0.5 text-right tabular-nums whitespace-nowrap">
                        {money(after)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        ) : null}
        {diff.missing.length > 0 ? (
          <section aria-label={t('library.update.missing')} role="alert">
            <h3 className="font-medium text-warning">{t('library.update.missing')}</h3>
            <p className="text-text-muted">{t('library.update.missingHint')}</p>
            <ul className="list-disc pl-5">
              {diff.missing.slice(0, MAX_LISTED).map((i) => (
                <li key={i.id}>{itemName(i)}</li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </Dialog>
  );
}
