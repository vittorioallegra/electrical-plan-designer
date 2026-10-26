import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { queryKeys } from '@/api/keys';
import { useSession } from '@/lib/auth/AuthProvider';
import { useRepositories } from '@/lib/repositories/provider';

// Backgrounds are fetched as blobs and shown via object URLs (never cross-origin URLs),
// so the canvas is never tainted and can be exported to PDF.
function decode(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image decode failed'));
    img.src = URL.createObjectURL(blob);
  });
}

/** Seeds the cache right after an upload, so the new background shows without a download. */
export function usePrimeBackgroundImage(): (assetId: string, image: HTMLImageElement) => void {
  const { userId } = useSession();
  const queryClient = useQueryClient();
  return useCallback(
    (assetId, image) => queryClient.setQueryData(queryKeys.backgroundImage(userId, assetId), image),
    [queryClient, userId],
  );
}

export function useBackgroundImage(assetId: string | undefined): {
  image: HTMLImageElement | null;
  failed: boolean;
} {
  const { userId } = useSession();
  const { files } = useRepositories();
  const query = useQuery({
    queryKey: queryKeys.backgroundImage(userId, assetId ?? ''),
    queryFn: () => files.download('backgrounds', assetId!).then(decode),
    enabled: Boolean(assetId),
    staleTime: Infinity,
  });
  if (!assetId) return { image: null, failed: false };
  return { image: query.data ?? null, failed: query.isError };
}
