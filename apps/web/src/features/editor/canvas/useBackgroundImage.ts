import { useEffect, useState } from 'react';
import { useRepositories } from '@/data';
import type { FileRepository } from '@/data/types';

// Backgrounds are fetched as blobs and shown via object URLs (never cross-origin URLs),
// so the canvas is never tainted and can be exported to PDF.
const cache = new Map<string, Promise<HTMLImageElement>>();

export function loadBackgroundImage(
  files: FileRepository,
  path: string,
): Promise<HTMLImageElement> {
  let pending = cache.get(path);
  if (!pending) {
    pending = files.download('backgrounds', path).then(
      (blob) =>
        new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = () => reject(new Error('image decode failed'));
          img.src = URL.createObjectURL(blob);
        }),
    );
    pending.catch(() => cache.delete(path));
    cache.set(path, pending);
  }
  return pending;
}

/** Seeds the cache right after an upload, so the new background shows without a download. */
export function primeBackgroundImage(path: string, image: HTMLImageElement): void {
  cache.set(path, Promise.resolve(image));
}

export function useBackgroundImage(path: string | undefined): {
  image: HTMLImageElement | null;
  failed: boolean;
} {
  const { files } = useRepositories();
  const [state, setState] = useState<{
    path?: string;
    image: HTMLImageElement | null;
    failed: boolean;
  }>({
    image: null,
    failed: false,
  });
  useEffect(() => {
    if (!path) return;
    let active = true;
    loadBackgroundImage(files, path).then(
      (image) => active && setState({ path, image, failed: false }),
      () => active && setState({ path, image: null, failed: true }),
    );
    return () => {
      active = false;
    };
  }, [files, path]);
  return state.path === path ? state : { image: null, failed: false };
}
