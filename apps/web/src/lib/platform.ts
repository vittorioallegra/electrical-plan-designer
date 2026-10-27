import { useEffect, useState } from 'react';

export type Platform = 'darwin' | 'win32' | 'linux';

/** The desktop app reports its OS; in a browser it is guessed from the user agent. */
export function getPlatform(): Platform {
  if (window.epd) return window.epd.platform;
  const hint = navigator.platform;
  if (/Mac|iPhone|iPad/.test(hint)) return 'darwin';
  return /Win/.test(hint) ? 'win32' : 'linux';
}

/** The shortcut modifier shown in hints: Command on macOS, Ctrl elsewhere. */
export function modifierLabel(platform: Platform = getPlatform()): string {
  return platform === 'darwin' ? '⌘' : 'Ctrl+';
}

/** Height of the title bar and of the drag strip over the pages without one (px). */
export const TITLE_BAR_HEIGHT = 40;

/**
 * True when the desktop app draws its own title bar and the macOS traffic lights sit over the
 * page (the window uses `hiddenInset`). Full screen has no traffic lights, so no inset. Windows
 * and Linux keep the native frame.
 */
export function useTitleBarInset(): boolean {
  const [fullScreen, setFullScreen] = useState(false);
  useEffect(() => {
    const host = window.epd?.window;
    if (!host) return;
    let live = true;
    void host.isFullScreen().then((value) => live && setFullScreen(value));
    const stop = host.onFullScreenChange(setFullScreen);
    return () => {
      live = false;
      stop();
    };
  }, []);
  return !!window.epd && window.epd.platform === 'darwin' && !fullScreen;
}
