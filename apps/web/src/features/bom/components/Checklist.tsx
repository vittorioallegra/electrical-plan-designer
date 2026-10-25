import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { bomCategoryOrder, type BomLine } from '@epd/domain/bom';
import { useEditor } from '@/stores/editor/EditorContext';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';
import { formatNumber, type Locale } from '@/lib/format';
import { NumberInput } from '@/components/ui/NumberInput';
import { describeBomLine, describeLineKey } from '@/lib/describeBom';
import { PurchasesLoadError } from './PurchasesLoadError';
import { useAnalysis } from '@/hooks/useAnalysis';
import { usePurchases } from '@/features/bom/hooks/usePurchases';
import { useCatalog } from '@/api/catalog';

/** Phone purchase checklist: one big row per BOM line, ticked lines store the bought quantity. */
export function Checklist() {
  const { t, i18n } = useTranslation();
  const locale: Locale = i18n.language === 'it' ? 'it' : 'en';
  const projectId = useEditor((s) => s.projectId);
  const { bom } = useAnalysis();
  const { lookup } = useCatalog();
  const purchases = usePurchases(projectId, bom);
  const [remainingOnly, setRemainingOnly] = useState(false);
  const qty = (n: number, unit: BomLine['unit']) =>
    `${formatNumber(n, locale)} ${t(`bom.units.${unit}`)}`;

  if (purchases.loadFailed) return <PurchasesLoadError purchases={purchases} />;
  if (purchases.loading) return <p className="text-text-muted">{t('common.loading')}</p>;
  if (bom.length === 0) return <p className="text-text-muted">{t('editor.empty.bom')}</p>;
  const done = bom.filter((l) => purchases.status.get(l.key)?.status === 'done').length;

  return (
    <div className="flex flex-col gap-4" data-testid="checklist">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-semibold">
          {t('purchases.progress', { done, total: bom.length })}
        </span>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            className="size-5"
            checked={remainingOnly}
            onChange={(e) => setRemainingOnly(e.target.checked)}
          />
          {t('purchases.remainingOnly')}
        </label>
      </div>
      {bomCategoryOrder.map((category) => {
        const lines = bom.filter(
          (l) =>
            l.category === category &&
            (!remainingOnly || purchases.status.get(l.key)?.status !== 'done'),
        );
        if (lines.length === 0) return null;
        return (
          <section key={category} aria-label={t(`bom.categories.${category}`)}>
            <h2 className="mb-1 text-lg font-semibold">{t(`bom.categories.${category}`)}</h2>
            <ul className="flex flex-col gap-1">
              {lines.map((line) => {
                const state = purchases.status.get(line.key);
                const name = describeBomLine(line, lookup, t, locale);
                return (
                  <li
                    key={line.key}
                    data-key={line.key}
                    data-status={state?.status ?? 'not_bought'}
                    className={cn(
                      'rounded border-2 px-3 py-2',
                      state?.status === 'done'
                        ? 'border-success bg-success-bg'
                        : state?.status === 'partial'
                          ? 'border-warning bg-warning-bg'
                          : 'border-text',
                    )}
                  >
                    <label className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        className="size-7 shrink-0"
                        checked={state?.status === 'done'}
                        onChange={() => purchases.toggle(line)}
                      />
                      <span className="min-w-0 flex-1">{name}</span>
                      <span className="text-xl font-semibold whitespace-nowrap tabular-nums">
                        {qty(line.quantity, line.unit)}
                      </span>
                    </label>
                    {state?.status === 'partial' ? (
                      <p className="mt-1 font-medium text-warning">
                        {t('purchases.partial', {
                          bought: qty(state.purchased!, line.unit),
                          need: qty(line.quantity, line.unit),
                        })}
                      </p>
                    ) : null}
                    {state && state.status !== 'not_bought' ? (
                      <label className="mt-1 flex items-center justify-end gap-2 text-text-muted">
                        {t('purchases.bought')}
                        <NumberInput
                          aria-label={t('purchases.boughtOf', { name })}
                          className="w-28"
                          value={state.purchased}
                          unit={t(`bom.units.${line.unit}`)}
                          min={0}
                          onValueChange={(v) => purchases.setPurchased(line.key, v)}
                        />
                      </label>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
      {purchases.orphans.length > 0 ? (
        <section aria-label={t('purchases.orphans')}>
          <h2 className="mb-1 text-lg font-semibold">{t('purchases.orphans')}</h2>
          <p className="mb-1 text-text-muted">{t('purchases.orphansHint')}</p>
          <ul className="flex flex-col gap-1">
            {purchases.orphans.map((o) => (
              <li
                key={o.key}
                className="flex items-center gap-3 rounded border border-border px-3 py-2"
              >
                <span className="min-w-0 flex-1">{describeLineKey(o.key, lookup, t, locale)}</span>
                <span className="tabular-nums">{formatNumber(o.purchased, locale)}</span>
                <Button variant="ghost" onClick={() => purchases.setPurchased(o.key, null)}>
                  {t('purchases.clear')}
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
