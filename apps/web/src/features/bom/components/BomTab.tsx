import { useTranslation } from 'react-i18next';
import { bomCategoryOrder, type BomLine } from '@epd/domain/bom';
import { EmptyState } from '@/components/ui/EmptyState';
import { Table } from '@/components/ui/Table';
import { formatNumber } from '@/lib/format';
import { useCatalog } from '@/hooks/useCatalog';
import { describeBomLine } from '@/lib/describeBom';
import { useAnalysis } from '@/hooks/useAnalysis';

/** Sum of a category's quantities, when every line shares one unit. */
function CategoryTotal({ lines }: { lines: readonly BomLine[] }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'it' ? 'it' : 'en';
  const unit = lines[0]!.unit;
  if (lines.some((l) => l.unit !== unit)) return null;
  const total = lines.reduce((sum, l) => sum + l.quantity, 0);
  return (
    <span
      className="font-mono text-body font-normal tracking-normal text-text normal-case tabular-nums"
      data-testid="bom-total"
    >
      {formatNumber(total, locale)} {t(`bom.units.${unit}`)}
    </span>
  );
}

export function BomTab() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'it' ? 'it' : 'en';
  const { bom } = useAnalysis();
  const { lookup } = useCatalog();
  if (bom.length === 0) return <EmptyState message={t('editor.empty.bom')} />;
  const groups = bomCategoryOrder
    .map((category) => [category, bom.filter((l) => l.category === category)] as const)
    .filter(([, lines]) => lines.length > 0);
  const hasCable = bom.some((l) => l.category === 'cable');
  return (
    <div className="flex flex-col gap-3 pb-3" data-testid="bom">
      {!hasCable ? <p className="pt-1 text-text-muted">{t('bom.noCableYet')}</p> : null}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(22rem,1fr))] gap-x-6 gap-y-4">
        {groups.map(([category, lines]) => (
          <section key={category} aria-label={t(`bom.categories.${category}`)}>
            <h3 className="flex h-8 items-center justify-between text-label font-semibold tracking-wide text-text-muted uppercase">
              {t(`bom.categories.${category}`)}
              <CategoryTotal lines={lines} />
            </h3>
            <Table<BomLine>
              rowKey={(l) => l.key}
              rows={[...lines]}
              columns={[
                {
                  key: 'description',
                  header: t('quote.description'),
                  cell: (line) => (
                    <span className={line.category === 'missing' ? 'text-error' : undefined}>
                      {describeBomLine(line, lookup, t, locale)}
                    </span>
                  ),
                },
                {
                  key: 'quantity',
                  header: t('quote.quantity'),
                  align: 'right',
                  cell: (line) => (
                    <span className="whitespace-nowrap">
                      {formatNumber(line.quantity, locale)} {t(`bom.units.${line.unit}`)}
                    </span>
                  ),
                },
              ]}
            />
          </section>
        ))}
      </div>
    </div>
  );
}
