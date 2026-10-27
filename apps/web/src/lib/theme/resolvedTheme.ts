import { useSyncExternalStore } from 'react';

export type ResolvedTheme = 'light' | 'dark';

const darkQuery = '(prefers-color-scheme: dark)';

/**
 * The theme in effect: `data-theme` on <html> when it forces one, else the OS setting
 * (`prefers-color-scheme`, which the desktop app drives through `nativeTheme.themeSource`).
 */
export function getResolvedTheme(): ResolvedTheme {
  if (typeof document === 'undefined') return 'light';
  const forced = document.documentElement.dataset.theme;
  if (forced === 'light' || forced === 'dark') return forced;
  return typeof window !== 'undefined' && window.matchMedia?.(darkQuery).matches ? 'dark' : 'light';
}

/** Calls `onChange` when the resolved theme may have changed; returns the unsubscribe function. */
export function subscribeResolvedTheme(onChange: () => void): () => void {
  const media = window.matchMedia?.(darkQuery);
  media?.addEventListener('change', onChange);
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  return () => {
    media?.removeEventListener('change', onChange);
    observer.disconnect();
  };
}

export function useResolvedTheme(): ResolvedTheme {
  return useSyncExternalStore(subscribeResolvedTheme, getResolvedTheme, () => 'light');
}
