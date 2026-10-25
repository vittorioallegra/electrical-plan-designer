import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { usePurchaseMarks, useSetPurchase } from '@/features/bom/api/purchases';
import { reconcilePurchases, type BomLine, type PurchaseLineStatus } from '@epd/domain/bom';
import { useToast } from '@/components/ui/Toast';

export interface Purchases {
  loading: boolean;
  /** Loading the marks failed: the lines must not be shown as not bought. */
  loadFailed: boolean;
  /** Loads the marks again after a failure. */
  retry(): void;
  /** Purchase state per BOM line key. */
  status: ReadonlyMap<string, PurchaseLineStatus>;
  /** Marks whose line left the BOM, with the quantity bought. */
  orphans: { key: string; purchased: number }[];
  /** Ticks a line with its full BOM quantity, or unticks it. */
  toggle(line: BomLine): void;
  /** Sets the bought quantity (null = not bought). */
  setPurchased(key: string, qty: number | null): void;
}

/** Purchase marks of a project, saved optimistically: a failed save rolls back with a toast. */
export function usePurchases(projectId: string, bom: readonly BomLine[]): Purchases {
  const { t } = useTranslation();
  const toast = useToast();
  const query = usePurchaseMarks(projectId);
  const onFailed = useCallback(() => toast(t('purchases.saveFailed'), 'error'), [toast, t]);
  const setPurchased = useSetPurchase(projectId, onFailed);
  const marks = query.data ?? null;
  // While a retry runs after a failure, show loading again instead of the error.
  const retrying = query.isError && query.isFetching;
  const loadFailed = query.isError && !retrying;

  const reconciled = useMemo(() => reconcilePurchases([...bom], marks ?? new Map()), [bom, marks]);
  const status = useMemo(() => new Map(reconciled.lines.map((l) => [l.key, l])), [reconciled]);
  const orphans = useMemo(
    () => reconciled.orphanKeys.map((key) => ({ key, purchased: marks?.get(key) ?? 0 })),
    [reconciled, marks],
  );

  return {
    loading: query.isPending || retrying,
    loadFailed,
    retry: () => void query.refetch(),
    status,
    orphans,
    toggle: (line) =>
      setPurchased(line.key, status.get(line.key)?.status === 'done' ? null : line.quantity),
    setPurchased,
  };
}
