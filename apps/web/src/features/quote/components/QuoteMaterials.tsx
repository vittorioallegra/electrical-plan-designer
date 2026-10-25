import { useTranslation } from 'react-i18next';
import type { QuoteResult } from '@epd/domain/quote';
import type { QuoteLine } from '@epd/domain/types';
import { useCatalog } from '@/api/catalog';
import { NumberInput } from '@/components/ui/NumberInput';
import { Table } from '@/components/ui/Table';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/lib/cn';
import { formatMoney, formatNumber, type Locale } from '@/lib/format';

/**
 * Material lines of the live quote. Unpriced lines, and lines priced by an account override,
 * take a price inline; it is saved as an account price override.
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
  const toast = useToast();
  const { profile, updateProfile } = useCatalog();
  const money = (cents: number | null) => (cents === null ? '—' : formatMoney(cents, locale));

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
            // Prices typed here are account overrides of this line: keep them editable.
            const own = profile?.priceOverrides[l.key]?.unitPrice;
            return l.unitPrice === null || own === l.unitPrice ? (
              <NumberInput
                aria-label={t('quote.priceFor', { name: l.description })}
                className={cn('w-28', l.unitPrice === null && 'border-warning')}
                value={l.unitPrice === null ? null : l.unitPrice / 100}
                unit="€"
                min={0}
                disabled={readOnly || !profile}
                onValueChange={(v) => void setPrice(l.key, v)}
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
