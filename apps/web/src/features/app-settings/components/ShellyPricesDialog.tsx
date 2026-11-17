import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { builtinById } from '@epd/domain/catalog/builtin';
import {
  applyShellyPrices,
  shellyPriceRows,
  shellyStoreHandles,
  shellyStoreProducts,
  type StorePrice,
} from '@epd/domain/catalog/shellyStore';
import { standardVatRates, type EuroCountry } from '@epd/domain/vatRates';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { useToast } from '@/components/ui/Toast';
import { useItemName } from '@/hooks/useItemName';
import { formatMoney } from '@/lib/format';
import { useEditorServices } from '@/stores/editor/EditorContext';
import { useLibrary } from '@/stores/library/useLibrary';

/**
 * "Update prices" of the Shelly catalog: asks Shelly's store for every model as soon as it opens,
 * shows the net prices (the company country's VAT removed) next to today's, and writes the
 * ticked ones into the library's price overrides.
 */
export function ShellyPricesDialog({
  country,
  onClose,
}: {
  country: EuroCountry;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'it' ? 'it' : 'en';
  const { library, storePrices } = useEditorServices();
  const overrides = useLibrary((s) => s.library.priceOverrides);
  const toast = useToast();
  const itemName = useItemName();
  const [answers, setAnswers] = useState<StorePrice[] | null>(null);
  const [asking, setAsking] = useState<readonly string[]>(shellyStoreHandles);
  // The request that last answered: while it is not `asking`, the store is being asked.
  const [answered, setAnswered] = useState<readonly string[] | null>(null);
  // The user's ticks; a row nobody touched is ticked when applying it changes something.
  const [picks, setPicks] = useState<ReadonlyMap<string, boolean>>(new Map());

  // Ask for `asking`; a retry asks again only the products that were rate limited.
  useEffect(() => {
    let live = true;
    void storePrices
      .shellyPrices(country, asking)
      .catch(() => asking.map((handle) => ({ handle, status: 'failed' as const })))
      .then((fresh) => {
        if (!live) return;
        setAnswers((before) => {
          const merged = new Map((before ?? []).map((a) => [a.handle, a]));
          for (const answer of fresh) merged.set(answer.handle, answer);
          return [...merged.values()];
        });
        setAnswered(asking);
      });
    return () => {
      live = false;
    };
  }, [storePrices, country, asking]);

  const rows = useMemo(
    () => (answers ? shellyPriceRows(answers, overrides, country) : []),
    [answers, overrides, country],
  );
  const ticked = useMemo(
    () => new Set(rows.filter((r) => picks.get(r.itemId) ?? r.changed).map((r) => r.itemId)),
    [rows, picks],
  );
  const rateLimited = rows.filter((r) => r.status === 'rate_limited');
  const loading = answered !== asking;
  const money = (cents: number | undefined) =>
    cents === undefined ? '—' : formatMoney(cents, locale);
  const countryName = new Intl.DisplayNames([i18n.language], { type: 'region' }).of(country);

  function apply() {
    const applied = rows.filter((r) => r.applicable && ticked.has(r.itemId));
    library.getState().apply((d) => {
      d.priceOverrides = applyShellyPrices(d.priceOverrides, rows, ticked);
    });
    toast(t('shellyPrices.done', { count: applied.length }), 'success');
    onClose();
  }

  return (
    <Dialog
      open
      wide
      onOpenChange={(o) => !o && onClose()}
      title={t('shellyPrices.title')}
      description={t('shellyPrices.description', {
        country: countryName,
        rate: standardVatRates[country] / 100,
      })}
      footer={
        <>
          {rateLimited.length > 0 && !loading ? (
            <Button
              variant="ghost"
              className="mr-auto"
              onClick={() =>
                setAsking(rateLimited.flatMap((r) => shellyStoreProducts[r.itemId]?.handle ?? []))
              }
            >
              {t('shellyPrices.retry')}
            </Button>
          ) : null}
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="primary"
            disabled={loading || !rows.some((r) => r.applicable && ticked.has(r.itemId))}
            onClick={apply}
          >
            {t('shellyPrices.apply')}
          </Button>
        </>
      }
    >
      {loading ? (
        // A spinner and a sentence: the request takes a few seconds (one product at a time).
        // Reduced motion stops the spin (styles.css); the sentence still says what happens.
        <div role="status" className="flex flex-col items-center gap-3 py-10 text-text-muted">
          <Loader2 size={24} className="animate-spin" aria-hidden />
          <p>{t('shellyPrices.loading')}</p>
          <p className="text-small text-text-faint">{t('shellyPrices.loadingHint')}</p>
        </div>
      ) : (
        <div className="max-h-[60vh] overflow-y-auto">
          <table className="w-full" aria-label={t('shellyPrices.title')}>
            <thead>
              <tr className="border-b border-border text-left text-small text-text-muted">
                <th className="w-6 py-1" />
                <th className="py-1 pr-2 font-medium">{t('shellyPrices.model')}</th>
                <th className="py-1 pr-2 text-right font-medium">{t('shellyPrices.current')}</th>
                <th className="py-1 pr-2 text-right font-medium">{t('shellyPrices.next')}</th>
                <th className="py-1 font-medium">{t('shellyPrices.status')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const name = itemName(builtinById.get(row.itemId), row.itemId);
                return (
                  <tr key={row.itemId} className="border-b border-border/60">
                    <td className="py-0.5">
                      <input
                        type="checkbox"
                        aria-label={name}
                        disabled={!row.applicable}
                        checked={row.applicable && ticked.has(row.itemId)}
                        onChange={(e) => setPicks(new Map(picks).set(row.itemId, e.target.checked))}
                      />
                    </td>
                    <td className="py-0.5 pr-2">{name}</td>
                    <td className="py-0.5 pr-2 text-right tabular-nums">{money(row.current)}</td>
                    <td className="py-0.5 pr-2 text-right tabular-nums">{money(row.next)}</td>
                    <td
                      className={row.applicable ? 'py-0.5 text-text-muted' : 'py-0.5 text-warning'}
                    >
                      {row.applicable && !row.changed
                        ? t('shellyPrices.statuses.unchanged')
                        : t(`shellyPrices.statuses.${row.status}`)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Dialog>
  );
}
