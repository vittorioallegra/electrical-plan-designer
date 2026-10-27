// The window background that shows before the page paints and around it (resize, full screen).
// Main cannot read the renderer's CSS, so the two hex values mirror the `chrome` and
// `dark-chrome` tokens of DESIGN.md (`--color-chrome` in apps/web/src/app/styles.css): change them together.

/** The chrome colour of DESIGN.md per theme. */
export function windowBackground(dark: boolean): string {
  return dark ? '#141517' : '#F4F5F6';
}

interface ThemeSource {
  shouldUseDarkColors: boolean;
  on(event: 'updated', listener: () => void): unknown;
  off(event: 'updated', listener: () => void): unknown;
}

interface Paintable {
  setBackgroundColor(color: string): void;
  isDestroyed(): boolean;
}

/**
 * Keeps `win`'s background in step with the resolved theme (a preference change or the system
 * switching). Returns the function that stops following.
 */
export function followTheme(win: Paintable, theme: ThemeSource): () => void {
  const update = () => {
    if (!win.isDestroyed()) win.setBackgroundColor(windowBackground(theme.shouldUseDarkColors));
  };
  theme.on('updated', update);
  return () => theme.off('updated', update);
}
