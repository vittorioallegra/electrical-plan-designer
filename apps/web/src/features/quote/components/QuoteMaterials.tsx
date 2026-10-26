import { useTranslation } from 'react-i18next';
import { setProjectPrice } from '@epd/domain/catalog/copies';
import type { QuoteResult } from '@epd/domain/quote';
import type { QuoteLine } from '@epd/domain/types';
import { useEditorContext } from '@/stores/editor/EditorContext';
import { NumberInput } from '@/components/ui/NumberInput';
import { Table } from '@/components/ui/Table';
import { cn } from '@/lib/cn';
import { formatMoney, formatNumber, type Locale } from '@/lib/format';

/**
 * Material lines of the live quote. Every line takes a price inline; it is saved in the project
 * only (the item's copy or the cable price), never in the library, as one undoable command.
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
  const money = (cents: number | null) => (cents === null ? '—' : formatMoney(cents, locale));

  function setPrice(key: string, euros: number) {
    store.getState().applyCommand('price', (d) => {
      setProjectPrice(d, key, Math.round(euros * 100));
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
          cell: (l) => (
            <NumberInput
              aria-label={t('quote.priceFor', { name: l.description })}
              className={cn('w-28', l.unitPrice === null && 'border-warning')}
              value={l.unitPrice === null ? null : l.unitPrice / 100}
              unit="€"
              min={0}
              disabled={readOnly}
              onValueChange={(v) => setPrice(l.key, v)}
            />
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
  );
}
