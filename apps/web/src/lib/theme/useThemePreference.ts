import { useCallback, useEffect, useState } from 'react';
import type { ThemePreference } from '@epd/bridge/bridge';
import { useEditorServices } from '@/stores/editor/EditorContext';

/**
 * The theme preference (System, Light or Dark) and a setter. The desktop app stores it in main,
 * which applies it to the whole app and tells every window; in a browser it is kept in
 * `localStorage` and set as `data-theme` on <html> (see the preferences repository).
 */
export function useThemePreference(): {
  theme: ThemePreference;
  setTheme: (theme: ThemePreference) => void;
} {
  const { preferences } = useEditorServices();
  const [theme, setThemeState] = useState<ThemePreference>('system');

  useEffect(() => {
    let current = true;
    void preferences.getTheme().then((stored) => {
      if (current) setThemeState(stored);
    });
    const unsubscribe = preferences.onThemeChanged((next) => {
      current = false; // a change that arrived first wins over the initial read
      setThemeState(next);
    });
    return () => {
      current = false;
      unsubscribe();
    };
  }, [preferences]);

  const setTheme = useCallback(
    (next: ThemePreference) => {
      setThemeState(next);
      void preferences.setTheme(next);
    },
    [preferences],
  );

  return { theme, setTheme };
}
