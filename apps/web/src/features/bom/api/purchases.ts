import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { queryKeys } from '@/api/keys';
import { useSession } from '@/lib/auth/AuthProvider';
import { useRepositories } from '@/lib/repositories/provider';

type Marks = Map<string, number | null>;

/** Bought quantity per BOM line key (null = not bought). */
export function usePurchaseMarks(projectId: string | null) {
  const { userId } = useSession();
  const { purchases } = useRepositories();
  return useQuery({
    queryKey: queryKeys.purchases(userId, projectId ?? ''),
    queryFn: () => purchases.list(projectId!),
    enabled: projectId !== null,
  });
}

/**
 * Saves one mark optimistically: the cache changes at once (the checkbox follows the click),
 * and a failure rolls back only that line, so saves of other lines made meanwhile are kept.
 * `onFailed` reports the failure.
 */
export function useSetPurchase(
  projectId: string | null,
  onFailed: () => void,
): (lineKey: string, qty: number | null) => void {
  const { userId } = useSession();
  const { purchases } = useRepositories();
  const queryClient = useQueryClient();
  const { mutate } = useMutation({
    mutationFn: ({
      lineKey,
      qty,
    }: {
      lineKey: string;
      qty: number | null;
      previous: number | null;
    }) => purchases.set(projectId!, lineKey, qty),
    onError: (_error, { lineKey, previous }) => {
      setMark(queryClient, queryKeys.purchases(userId, projectId ?? ''), lineKey, previous);
      onFailed();
    },
  });
  return useCallback(
    (lineKey: string, qty: number | null) => {
      if (projectId === null) return;
      const key = queryKeys.purchases(userId, projectId);
      const previous = queryClient.getQueryData<Marks>(key)?.get(lineKey) ?? null;
      setMark(queryClient, key, lineKey, qty);
      mutate({ lineKey, qty, previous });
    },
    [queryClient, userId, projectId, mutate],
  );
}

function setMark(
  queryClient: QueryClient,
  key: readonly unknown[],
  lineKey: string,
  qty: number | null,
) {
  queryClient.setQueryData<Marks>(key, (m) => new Map(m ?? []).set(lineKey, qty));
}
