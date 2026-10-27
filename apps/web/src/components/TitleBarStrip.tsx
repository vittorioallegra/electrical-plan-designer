import { createContext, useContext } from 'react';
import { TITLE_BAR_HEIGHT, useTitleBarInset } from '@/lib/platform';

/** Empty drag strip standing in for the title bar on pages that have none (macOS only). */
export function TitleBarStrip() {
  return (
    <div
      aria-hidden
      data-testid="title-bar-strip"
      style={{ height: TITLE_BAR_HEIGHT }}
      className="app-drag shrink-0 border-b border-border bg-chrome"
    />
  );
}

const TitleBarDrawn = createContext(false);

/** Marks the subtree below a frame that already draws the title bar or its drag strip. */
export const TitleBarDrawnProvider = TitleBarDrawn.Provider;

/**
 * True when a page must draw its own drag strip: the window has no native title bar (macOS) and
 * no frame above has drawn one. Error screens that replace a whole frame use it.
 */
export function useNeedsTitleBarStrip(): boolean {
  const drawn = useContext(TitleBarDrawn);
  const inset = useTitleBarInset();
  return inset && !drawn;
}
