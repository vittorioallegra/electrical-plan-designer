import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useRepositories } from '@/data';
import { reconcilePurchases, type BomLine, type PurchaseLineStatus } from '@epd/domain/bom';
import { useToast } from '@/ui/Toast';

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
  const { purchases } = useRepositories();
  const toast = useToast();
  const [marks, setMarks] = useState<Map<string, number | null> | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  // Last rendered marks, read by the rollback of a failed save.
  const current = useRef(marks);
  useEffect(() => {
    current.current = marks;
  }, [marks]);

  useEffect(() => {
    let active = true;
    purchases
      .list(projectId)
      .then((m) => {
        if (active) setMarks(m);
      })
      .catch(() => {
        if (active) setLoadFailed(true);
      });
    return () => {
      active = false;
    };
  }, [purchases, projectId, attempt]);

  const setPurchased = useCallback(
    (key: string, qty: number | null) => {
      const previous = current.current?.get(key) ?? null;
      setMarks((m) => new Map(m ?? []).set(key, qty));
      purchases.set(projectId, key, qty).catch(() => {
        setMarks((m) => new Map(m ?? []).set(key, previous));
        toast(t('purchases.saveFailed'), 'error');
      });
    },
    [purchases, projectId, toast, t],
  );

  const reconciled = useMemo(() => reconcilePurchases([...bom], marks ?? new Map()), [bom, marks]);
  const status = useMemo(() => new Map(reconciled.lines.map((l) => [l.key, l])), [reconciled]);
  const orphans = useMemo(
    () => reconciled.orphanKeys.map((key) => ({ key, purchased: marks?.get(key) ?? 0 })),
    [reconciled, marks],
  );

  return {
    loading: marks === null && !loadFailed,
    loadFailed,
    retry: () => {
      setLoadFailed(false);
      setAttempt((n) => n + 1);
    },
    status,
    orphans,
    toggle: (line) =>
      setPurchased(line.key, status.get(line.key)?.status === 'done' ? null : line.quantity),
    setPurchased,
  };
}
