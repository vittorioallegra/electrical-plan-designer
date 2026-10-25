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
export function usePrimeBackgroundImage(): (path: string, image: HTMLImageElement) => void {
  const { userId } = useSession();
  const queryClient = useQueryClient();
  return useCallback(
    (path, image) => queryClient.setQueryData(queryKeys.backgroundImage(userId, path), image),
    [queryClient, userId],
  );
}

export function useBackgroundImage(path: string | undefined): {
  image: HTMLImageElement | null;
  failed: boolean;
} {
  const { userId } = useSession();
  const { files } = useRepositories();
  const query = useQuery({
    queryKey: queryKeys.backgroundImage(userId, path ?? ''),
    queryFn: () => files.download('backgrounds', path!).then(decode),
    enabled: Boolean(path),
    staleTime: Infinity,
  });
  if (!path) return { image: null, failed: false };
  return { image: query.data ?? null, failed: query.isError };
}
