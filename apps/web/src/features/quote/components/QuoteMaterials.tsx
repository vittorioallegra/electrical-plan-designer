import { useTranslation } from 'react-i18next';
import type { QuoteResult } from '@epd/domain/quote';
import type { QuoteLine } from '@epd/domain/types';
import { useCatalog } from '@/hooks/useCatalog';
import { useEditorContext } from '@/stores/editor/EditorContext';
import { NumberInput } from '@/components/ui/NumberInput';
import { Table } from '@/components/ui/Table';
import { cn } from '@/lib/cn';
import { formatMoney, formatNumber, type Locale } from '@/lib/format';

/**
 * Material lines of the live quote. Unpriced lines, and lines priced by a project override,
 * take a price inline; it is saved as a project price override.
 */
export function QuoteMaterials({
  quote,
  locale,
  readOnly,
}: {
  quote: QuoteResult;
  locale: Locale;
  readOnly: boolean;
}) {
  const { t } = useTranslation();
  const { store } = useEditorContext();
  const { priceOverrides } = useCatalog();
  const money = (cents: number | null) => (cents === null ? '—' : formatMoney(cents, locale));

  function setPrice(key: string, euros: number) {
    store.getState().applyCommand('price', (d) => {
      d.priceOverrides[key] = { ...d.priceOverrides[key], unitPrice: Math.round(euros * 100) };
    });
  }

  return (
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
          cell: (l) => {
            // Prices typed here are project overrides of this line: keep them editable.
            const own = priceOverrides[l.key]?.unitPrice;
            return l.unitPrice === null || own === l.unitPrice ? (
              <NumberInput
                aria-label={t('quote.priceFor', { name: l.description })}
                className={cn('w-28', l.unitPrice === null && 'border-warning')}
                value={l.unitPrice === null ? null : l.unitPrice / 100}
                unit="€"
                min={0}
                disabled={readOnly}
                onValueChange={(v) => setPrice(l.key, v)}
              />
            ) : (
              money(l.unitPrice)
            );
          },
        },
        {
          key: 'total',
          header: t('quote.lineTotal'),
          align: 'right',
          cell: (l) => money(l.total),
        },
      ]}
    />
  );
}
