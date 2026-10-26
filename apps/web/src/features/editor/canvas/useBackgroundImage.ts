import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { queryKeys } from '@/api/keys';
import { useEditor } from '@/stores/editor/EditorContext';
import { assetBlob, type ProjectAsset } from '@/lib/projectFile/epd';

// Backgrounds are decoded from the project's asset bytes and shown via object URLs, so the
// canvas is never tainted and can be exported to PDF.
function decode(asset: ProjectAsset): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image decode failed'));
    img.src = URL.createObjectURL(assetBlob(asset));
  });
}

/** Seeds the cache right after an import, so the new background shows without decoding. */
export function usePrimeBackgroundImage(): (assetId: string, image: HTMLImageElement) => void {
  const queryClient = useQueryClient();
  return useCallback(
    (assetId, image) => queryClient.setQueryData(queryKeys.backgroundImage(assetId), image),
    [queryClient],
  );
}

export function useBackgroundImage(assetId: string | undefined): {
  image: HTMLImageElement | null;
  failed: boolean;
} {
  const asset = useEditor((s) => (assetId ? s.assets.get(assetId) : undefined));
  const query = useQuery({
    queryKey: queryKeys.backgroundImage(assetId ?? ''),
    queryFn: () => (asset ? decode(asset) : Promise.reject(new Error('missing asset'))),
    enabled: Boolean(assetId),
    staleTime: Infinity,
  });
  if (!assetId) return { image: null, failed: false };
  return { image: query.data ?? null, failed: query.isError };
}
