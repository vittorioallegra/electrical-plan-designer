import { useTranslation } from 'react-i18next';
import { bomCategoryOrder, type BomLine, type PurchaseLineStatus } from '@epd/domain/bom';
import { useEditor } from '@/stores/editor/EditorContext';
import { formatNumber } from '@/lib/format';
import { useCatalog } from '@/api/catalog';
import { describeBomLine } from '@/lib/describeBom';
import { useAnalysis } from '@/hooks/useAnalysis';
import { PurchasesLoadError } from './PurchasesLoadError';
import { usePurchases } from '@/features/bom/hooks/usePurchases';

/** Sum of a category's quantities, when every line shares one unit. */
function CategoryTotal({ lines }: { lines: readonly BomLine[] }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'it' ? 'it' : 'en';
  const unit = lines[0]!.unit;
  if (lines.some((l) => l.unit !== unit)) return null;
  const total = lines.reduce((sum, l) => sum + l.quantity, 0);
  return (
    <span className="tabular-nums" data-testid="bom-total">
      {formatNumber(total, locale)} {t(`bom.units.${unit}`)}
    </span>
  );
}

function PartialNote({
  line,
  purchased,
}: {
  line: BomLine;
  purchased?: PurchaseLineStatus | undefined;
}) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'it' ? 'it' : 'en';
  if (purchased?.status !== 'partial') return null;
  const qty = (n: number) => `${formatNumber(n, locale)} ${t(`bom.units.${line.unit}`)}`;
  return (
    <span className="block text-warning">
      {t('purchases.partial', { bought: qty(purchased.purchased!), need: qty(line.quantity) })}
    </span>
  );
}

export function BomTab() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'it' ? 'it' : 'en';
  const { bom } = useAnalysis();
  const { lookup } = useCatalog();
  const projectId = useEditor((s) => s.projectId);
  const purchases = usePurchases(projectId, bom);
  if (bom.length === 0) return <p className="text-text-muted">{t('editor.empty.bom')}</p>;
  const groups = bomCategoryOrder
    .map((category) => [category, bom.filter((l) => l.category === category)] as const)
    .filter(([, lines]) => lines.length > 0);
  const hasCable = bom.some((l) => l.category === 'cable');
  return (
    <div className="flex flex-col gap-1" data-testid="bom">
      {purchases.loadFailed ? <PurchasesLoadError purchases={purchases} /> : null}
      {!hasCable ? <p className="text-text-muted">{t('bom.noCableYet')}</p> : null}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(18rem,1fr))] gap-x-6 gap-y-2">
        {groups.map(([category, lines]) => (
          <section key={category} aria-label={t(`bom.categories.${category}`)}>
            <h3 className="mb-0.5 flex justify-between border-b border-border font-medium">
              {t(`bom.categories.${category}`)}
              <CategoryTotal lines={lines} />
            </h3>
            <table className="w-full">
              <tbody>
                {lines.map((line: BomLine) => (
                  <tr
                    key={line.key}
                    data-key={line.key}
                    className={line.category === 'missing' ? 'text-error' : ''}
                  >
                    <td className="w-6 py-0.5 align-top">
                      <input
                        type="checkbox"
                        aria-label={t('purchases.boughtOf', {
                          name: describeBomLine(line, lookup, t, locale),
                        })}
                        disabled={purchases.loading || purchases.loadFailed}
                        checked={purchases.status.get(line.key)?.status === 'done'}
                        onChange={() => purchases.toggle(line)}
                      />
                    </td>
                    <td className="py-0.5 pr-2">
                      {describeBomLine(line, lookup, t, locale)}
                      <PartialNote line={line} purchased={purchases.status.get(line.key)} />
                    </td>
                    <td className="py-0.5 text-right whitespace-nowrap tabular-nums">
                      {formatNumber(line.quantity, locale)} {t(`bom.units.${line.unit}`)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))}
      </div>
    </div>
  );
}
