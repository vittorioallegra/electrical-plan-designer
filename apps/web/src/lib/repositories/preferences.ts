// The app preferences (today: the theme). The desktop app keeps them in its app data folder
// through `window.epd` (main applies the theme to the whole app and tells every window); in a
// browser (dev, browser E2E) they live in `localStorage` and the theme is `data-theme` on <html>.
// Without a storage and a root the fake is purely in memory, for jsdom tests.
import type { EpdBridge, ThemePreference } from '@epd/bridge/bridge';
import { themePreferences } from '@epd/bridge/bridge';
import type { PreferencesRepository } from './types';

export function createDesktopPreferencesRepository(
  preferences: EpdBridge['preferences'],
): PreferencesRepository {
  return {
    getTheme: () => preferences.getTheme(),
    setTheme: (theme) => preferences.setTheme(theme),
    onThemeChanged: (listener) => preferences.onThemeChanged(listener),
  };
}

export const themeStorageKey = 'epd.theme';

const isTheme = (value: unknown): value is ThemePreference =>
  themePreferences.includes(value as ThemePreference);

export interface MemoryPreferencesOptions {
  /** Where the preference survives a reload (the browser's `localStorage`). */
  storage?: Pick<Storage, 'getItem' | 'setItem'> | undefined;
  /** The element that gets `data-theme` (`document.documentElement`); `system` removes it. */
  root?: HTMLElement;
}

export function createMemoryPreferencesRepository({
  storage,
  root,
}: MemoryPreferencesOptions = {}): PreferencesRepository {
  const listeners = new Set<(theme: ThemePreference) => void>();
  let theme: ThemePreference = 'system';
  try {
    const stored = storage?.getItem(themeStorageKey);
    if (isTheme(stored)) theme = stored;
  } catch {
    // Storage may be blocked: the preference then lasts until the page closes.
  }

  const apply = () => {
    if (!root) return;
    if (theme === 'system') delete root.dataset.theme;
    else root.dataset.theme = theme;
  };
  apply();

  return {
    async getTheme() {
      return theme;
    },
    async setTheme(next) {
      theme = next;
      try {
        storage?.setItem(themeStorageKey, next);
      } catch {
        // See above.
      }
      apply();
      listeners.forEach((listener) => listener(next));
    },
    onThemeChanged(listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
  };
}
