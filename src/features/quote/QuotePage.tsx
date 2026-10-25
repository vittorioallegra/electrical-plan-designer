import { Plus, Stamp, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useRepositories } from '@/data';
import { formatQuoteNumber, issueQuote, type QuoteResult } from '@/domain/quote';
import type { QuoteLine, QuoteSettings } from '@/domain/types';
import { useEditor, useEditorContext } from '@/state/EditorContext';
import { Button } from '@/ui/Button';
import { formatMoney, formatNumber, type Locale } from '@/ui/format';
import { NumberInput } from '@/ui/NumberInput';
import { Table } from '@/ui/Table';
import { useToast } from '@/ui/Toast';
import { useAnalysis } from '../bom/useAnalysis';
import { useCatalog } from '../catalog/useCatalog';
import { useLiveQuote, usePriceContext } from './useQuote';

type LaborLine = QuoteSettings['laborLines'][number];

/** Quote settings, live totals, unpriced lines with inline prices, and issued snapshots. */
export function QuotePage() {
  const { t, i18n } = useTranslation();
  const locale: Locale = i18n.language === 'it' ? 'it' : 'en';
  const { store } = useEditorContext();
  const { profile: profileRepo } = useRepositories();
  const toast = useToast();
  const readOnly = useEditor((s) => s.readOnly);
  const settings = useEditor((s) => s.data.quote.settings);
  const issued = useEditor((s) => s.data.quote.issued);
  const { quote, describe } = useLiveQuote();
  const { bom } = useAnalysis();
  const ctx = usePriceContext();
  const { profile, updateProfile } = useCatalog();
  const [issuing, setIssuing] = useState(false);

  const editSettings = (label: string, fn: (s: QuoteSettings) => void) =>
    store.getState().applyCommand(label, (d) => {
      fn(d.quote.settings);
    });

  async function setPrice(key: string, euros: number) {
    if (!profile) return;
    const next = {
      ...profile.priceOverrides,
      [key]: { ...profile.priceOverrides[key], unitPrice: Math.round(euros * 100) },
    };
    try {
      await updateProfile({ priceOverrides: next });
    } catch {
      toast(t('catalog.saveFailed'), 'error');
    }
  }

  async function issue() {
    setIssuing(true);
    try {
      const number = await profileRepo.nextQuoteNumber();
      const snapshot = issueQuote(bom, ctx, settings, describe, number, new Date(), i18n.language);
      store.getState().appendIssuedQuote(snapshot);
      toast(t('quote.issuedToast', { number: formatQuoteNumber(snapshot) }), 'success');
    } catch {
      toast(t('quote.issueFailed'), 'error');
    } finally {
      setIssuing(false);
    }
  }

  const money = (cents: number | null) => (cents === null ? '—' : formatMoney(cents, locale));

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="mx-auto flex max-w-6xl flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-xl font-semibold">{t('pages.quote')}</h1>
          <Button variant="primary" disabled={readOnly || issuing} onClick={() => void issue()}>
            <Stamp size={16} />
            {t('quote.issue')}
          </Button>
        </div>
        {quote.totals.unpricedCount > 0 ? (
          <p className="rounded bg-warning-bg px-3 py-1.5 text-warning" role="status">
            {t('quote.unpriced', { count: quote.totals.unpricedCount })}
          </p>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
          <section aria-label={t('quote.materials')}>
            <h2 className="mb-1 font-medium">{t('quote.materials')}</h2>
            <Table<QuoteLine>
              rowKey={(l) => l.key}
              rows={quote.lines}
              columns={[
                { key: 'code', header: t('quote.code'), cell: (l) => l.code ?? '' },
                { key: 'description', header: t('quote.description'), cell: (l) => l.description },
                {
                  key: 'quantity',
                  header: t('quote.quantity'),
                  align: 'right',
                  cell: (l) => `${formatNumber(l.quantity, locale)} ${t(`bom.units.${l.unit}`)}`,
                },
                {
                  key: 'unitPrice',
                  header: t('quote.unitPrice'),
                  align: 'right',
                  cell: (l) =>
                    l.unitPrice === null ? (
                      <NumberInput
                        aria-label={t('quote.priceFor', { name: l.description })}
                        className="w-28 border-warning"
                        value={null}
                        unit="€"
                        min={0}
                        disabled={readOnly || !profile}
                        onValueChange={(v) => void setPrice(l.key, v)}
                      />
                    ) : (
                      money(l.unitPrice)
                    ),
                },
                {
                  key: 'total',
                  header: t('quote.lineTotal'),
                  align: 'right',
                  cell: (l) => money(l.total),
                },
              ]}
            />
          </section>

          <div className="flex flex-col gap-4">
            <section aria-label={t('quote.settings')} className="flex flex-col gap-2">
              <h2 className="font-medium">{t('quote.settings')}</h2>
              <label className="flex items-center justify-between gap-2">
                {t('quote.adjustment')}
                <NumberInput
                  aria-label={t('quote.adjustment')}
                  className="w-28"
                  value={settings.materialAdjustmentPercent}
                  unit="%"
                  min={-100}
                  max={1000}
                  disabled={readOnly}
                  onValueChange={(v) =>
                    editSettings('quote adjustment', (s) => void (s.materialAdjustmentPercent = v))
                  }
                />
              </label>
              <label className="flex items-center justify-between gap-2">
                {t('quote.vat')}
                <NumberInput
                  aria-label={t('quote.vat')}
                  className="w-28"
                  value={settings.vatPercent}
                  unit="%"
                  min={0}
                  max={100}
                  disabled={readOnly}
                  onValueChange={(v) => editSettings('quote vat', (s) => void (s.vatPercent = v))}
                />
              </label>
            </section>
            <Totals quote={quote} locale={locale} />
          </div>
        </div>

        <LaborLines lines={settings.laborLines} readOnly={readOnly} edit={editSettings} />

        <section aria-label={t('quote.issuedTitle')}>
          <h2 className="mb-1 font-medium">{t('quote.issuedTitle')}</h2>
          {issued.length === 0 ? (
            <p className="text-text-muted">{t('quote.noIssued')}</p>
          ) : (
            <ul className="divide-y divide-border">
              {[...issued].reverse().map((q) => (
                <li key={q.number} className="flex flex-wrap items-center gap-x-4 py-1">
                  <span className="font-medium tabular-nums">{formatQuoteNumber(q)}</span>
                  <span className="text-text-muted">
                    {new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' }).format(
                      new Date(q.issuedAt),
                    )}
                  </span>
                  <span className="tabular-nums">{money(q.totals.total)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function Totals({ quote, locale }: { quote: QuoteResult; locale: Locale }) {
  const { t } = useTranslation();
  const { totals } = quote;
  const rows: [string, number][] = [
    ['quote.totals.materialsBeforeAdjustment', totals.materialsBeforeAdjustment],
    ['quote.totals.adjustment', totals.adjustment],
    ['quote.totals.materials', totals.materials],
    ['quote.totals.labor', totals.labor],
    ['quote.totals.taxable', totals.taxable],
    ['quote.totals.vat', totals.vat],
  ];
  return (
    <section aria-label={t('quote.totalsTitle')} data-testid="quote-totals">
      <h2 className="mb-1 font-medium">{t('quote.totalsTitle')}</h2>
      <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-0.5 tabular-nums">
        {rows.map(([key, cents]) => (
          <div key={key} className="contents">
            <dt className="text-text-muted">{t(key)}</dt>
            <dd className="text-right">{formatMoney(cents, locale)}</dd>
          </div>
        ))}
        <dt className="border-t border-border pt-1 font-semibold">{t('quote.totals.total')}</dt>
        <dd
          className="border-t border-border pt-1 text-right font-semibold"
          data-testid="quote-total"
        >
          {formatMoney(totals.total, locale)}
        </dd>
      </dl>
    </section>
  );
}

function LaborLines({
  lines,
  readOnly,
  edit,
}: {
  lines: LaborLine[];
  readOnly: boolean;
  edit: (label: string, fn: (s: QuoteSettings) => void) => unknown;
}) {
  const { t } = useTranslation();
  const update = (i: number, fn: (l: LaborLine) => void) =>
    edit('edit labor line', (s) => fn(s.laborLines[i]!));
  return (
    <section aria-label={t('quote.labor')} className="flex flex-col gap-2">
      <h2 className="font-medium">{t('quote.labor')}</h2>
      {lines.length === 0 ? <p className="text-text-muted">{t('quote.noLabor')}</p> : null}
      {lines.map((line, i) => (
        <div
          key={`${i}:${line.kind}:${line.description}`}
          className="flex flex-wrap items-center gap-2"
          data-testid="labor-line"
        >
          <input
            aria-label={t('quote.laborDescription')}
            className="h-[var(--control-height)] min-w-48 flex-1 rounded border border-border px-2"
            defaultValue={line.description}
            disabled={readOnly}
            onBlur={(e) => {
              const description = e.target.value.trim();
              if (description !== line.description)
                update(i, (l) => void (l.description = description));
            }}
          />
          {line.kind === 'lump' ? (
            <NumberInput
              aria-label={t('quote.amount')}
              className="w-32"
              value={line.amount}
              unit="€"
              min={0}
              disabled={readOnly}
              onValueChange={(v) => update(i, (l) => void (l.kind === 'lump' && (l.amount = v)))}
            />
          ) : (
            <>
              <NumberInput
                aria-label={t('quote.hours')}
                className="w-24"
                value={line.hours}
                unit="h"
                min={0}
                disabled={readOnly}
                onValueChange={(v) => update(i, (l) => void (l.kind === 'hourly' && (l.hours = v)))}
              />
              <NumberInput
                aria-label={t('quote.hourlyRate')}
                className="w-32"
                value={line.hourlyRate}
                unit="€/h"
                min={0}
                disabled={readOnly}
                onValueChange={(v) =>
                  update(i, (l) => void (l.kind === 'hourly' && (l.hourlyRate = v)))
                }
              />
            </>
          )}
          <Button
            variant="ghost"
            aria-label={t('quote.removeLabor')}
            disabled={readOnly}
            onClick={() => edit('remove labor line', (s) => void s.laborLines.splice(i, 1))}
          >
            <Trash2 size={14} />
          </Button>
        </div>
      ))}
      <div className="flex gap-2">
        <Button
          disabled={readOnly}
          onClick={() =>
            edit('add labor line', (s) =>
              s.laborLines.push({ kind: 'lump', description: t('quote.defaultLump'), amount: 0 }),
            )
          }
        >
          <Plus size={14} />
          {t('quote.addLump')}
        </Button>
        <Button
          disabled={readOnly}
          onClick={() =>
            edit('add labor line', (s) =>
              s.laborLines.push({
                kind: 'hourly',
                description: t('quote.defaultHourly'),
                hours: 0,
                hourlyRate: 0,
              }),
            )
          }
        >
          <Plus size={14} />
          {t('quote.addHourly')}
        </Button>
      </div>
    </section>
  );
}
