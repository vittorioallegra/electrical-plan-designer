interface Revealable {
  isMinimized(): boolean;
  isVisible(): boolean;
  restore(): void;
  show(): void;
  focus(): void;
}

/** Brings a window the user cannot see (minimized or hidden) forward and focuses it. */
export function revealWindow(win: Revealable): void {
  if (win.isMinimized()) win.restore();
  if (!win.isVisible()) win.show();
  win.focus();
}
