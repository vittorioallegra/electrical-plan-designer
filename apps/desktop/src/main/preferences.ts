// The app preferences (today: the theme), kept in `preferences.json` in the app data (written
// atomically). A missing, unreadable or invalid file means the defaults; a value that is not
// valid falls back on its own default. No Electron imports: tested in plain Node.
import * as nodeFs from 'node:fs/promises';
import { themePreferences, type ThemePreference } from '@epd/bridge/bridge';
import { atomicWrite, type FsOps } from './atomicWrite';

export interface Preferences {
  theme: ThemePreference;
}

export const defaultPreferences: Preferences = { theme: 'system' };

export interface PreferencesService {
  /** Reads the file (once); call before using `theme`. */
  load(): Promise<void>;
  /** The stored theme (the default until `load` has finished). */
  theme(): ThemePreference;
  /** Stores the theme; listeners run first, so a failed write still applies for this run. */
  setTheme(theme: ThemePreference): Promise<void>;
  /** Called after every change of the theme. */
  onThemeChange(listener: (theme: ThemePreference) => void): void;
}

export function createPreferencesService({
  file,
  fs = nodeFs,
}: {
  file: string;
  fs?: FsOps;
}): PreferencesService {
  let current: Preferences = { ...defaultPreferences };
  let loaded: Promise<void> | undefined;
  let queue: Promise<unknown> = Promise.resolve();
  const listeners: ((theme: ThemePreference) => void)[] = [];

  async function read(): Promise<void> {
    try {
      const json = JSON.parse(new TextDecoder().decode(await fs.readFile(file))) as {
        theme?: unknown;
      } | null;
      const theme = json?.theme;
      if (themePreferences.includes(theme as ThemePreference))
        current = { ...current, theme: theme as ThemePreference };
    } catch {
      // No file yet, or one that cannot be read: defaults (the next change rewrites it).
    }
  }

  const load = () => (loaded ??= read());

  return {
    load,
    theme: () => current.theme,
    async setTheme(theme) {
      await load();
      current = { ...current, theme };
      listeners.forEach((listener) => listener(theme));
      const snapshot = JSON.stringify({ version: 1, ...current });
      // Writes never interleave: the last one wins on disk too.
      const write = queue.then(() => atomicWrite(file, new TextEncoder().encode(snapshot), fs));
      queue = write.catch(() => undefined);
      await write.catch((error: unknown) => {
        // The choice stays right for this run; a failed write only loses it at the next start.
        console.error('preferences not saved', error);
      });
    },
    onThemeChange: (listener) => void listeners.push(listener),
  };
}
