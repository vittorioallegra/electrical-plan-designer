import { TITLE_BAR_HEIGHT } from '@/lib/platform';

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
