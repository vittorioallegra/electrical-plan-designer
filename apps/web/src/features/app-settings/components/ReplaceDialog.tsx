import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { diffCatalogReplacement, type IncomingCatalog } from '@epd/domain/catalog/replace';
import type { ProjectCatalog } from '@epd/domain/catalog/types';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { formatMoney } from '@/lib/format';

const MAX_LISTED = 50;

/**
 * What replacing a catalog with a newer list changes, before it happens: price changes, new
 * items, items in use that the new list lacks, and hand-edited items to keep or overwrite.
 */
export function ReplaceDialog({
  catalog,
  incoming,
  used,
  onClose,
  onReplace,
}: {
  catalog: ProjectCatalog;
  incoming: IncomingCatalog;
  used: ReadonlySet<string>;
  onClose: () => void;
  onReplace: (keepEdited: ReadonlySet<string>) => void;
}) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'it' ? 'it' : 'en';
  const diff = useMemo(
    () => diffCatalogReplacement(catalog, incoming.items, used),
    [catalog, incoming, used],
  );
  const conflicts = diff.changed.filter((c) => c.editConflict);
  const [keep, setKeep] = useState<ReadonlySet<string>>(
    () => new Set(conflicts.map((c) => c.before.id)),
  );
  const priceChanges = diff.changed.filter((c) => c.priceChanged);
  const missingInUse = diff.missing.filter((m) => m.inUse);
  const money = (cents: number | undefined) =>
    cents === undefined ? '—' : formatMoney(cents, locale);

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={t('catalog.replace.title', { name: catalog.name })}
      footer={
        <>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="primary" onClick={() => onReplace(keep)}>
            {t('catalog.replace.confirm')}
          </Button>
        </>
      }
    >
      <div className="flex max-h-[60vh] flex-col gap-3 overflow-y-auto" data-testid="replace-diff">
        <ul className="list-disc pl-5">
          <li>{t('catalog.replace.unchanged', { count: diff.unchanged.length })}</li>
          <li>{t('catalog.replace.changed', { count: diff.changed.length })}</li>
          <li>{t('catalog.replace.added', { count: diff.added.length })}</li>
          <li>
            {t('catalog.replace.dropped', {
              count: diff.missing.length - missingInUse.length,
            })}
          </li>
        </ul>
        {priceChanges.length > 0 ? (
          <section aria-label={t('catalog.replace.priceChanges')}>
            <h3 className="font-medium">{t('catalog.replace.priceChanges')}</h3>
            <table className="w-full">
              <tbody>
                {priceChanges.slice(0, MAX_LISTED).map((c) => (
                  <tr key={c.before.id} className="border-b border-border/60">
                    <td className="py-0.5 pr-2">{c.after.name}</td>
                    <td className="py-0.5 text-right tabular-nums whitespace-nowrap">
                      {money(c.before.unitPrice)} → {money(c.after.unitPrice)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : null}
        {missingInUse.length > 0 ? (
          <section aria-label={t('catalog.replace.missingInUse')} role="alert">
            <h3 className="font-medium text-warning">{t('catalog.replace.missingInUse')}</h3>
            <p className="text-text-muted">{t('catalog.replace.missingInUseHint')}</p>
            <ul className="list-disc pl-5">
              {missingInUse.slice(0, MAX_LISTED).map((m) => (
                <li key={m.item.id}>{m.item.name}</li>
              ))}
            </ul>
          </section>
        ) : null}
        {conflicts.length > 0 ? (
          <section aria-label={t('catalog.replace.edited')}>
            <h3 className="font-medium">{t('catalog.replace.edited')}</h3>
            <p className="text-text-muted">{t('catalog.replace.editedHint')}</p>
            {conflicts.map((c) => (
              <label key={c.before.id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={keep.has(c.before.id)}
                  onChange={(e) => {
                    const next = new Set(keep);
                    if (e.target.checked) next.add(c.before.id);
                    else next.delete(c.before.id);
                    setKeep(next);
                  }}
                />
                {t('catalog.replace.keepEdit', { name: c.before.name })}
              </label>
            ))}
          </section>
        ) : null}
      </div>
    </Dialog>
  );
}
