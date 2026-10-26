import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { _electron, type ElectronApplication, type Page } from '@playwright/test';

// Playwright runs from apps/desktop.
const appDir = process.cwd();

export interface LaunchedApp {
  app: ElectronApplication;
  page: Page;
  userData: string;
  close: () => Promise<void>;
}

/** Launches the built app with a fresh, temporary `userData` folder. */
export async function launchApp(): Promise<LaunchedApp> {
  const userData = mkdtempSync(join(tmpdir(), 'epd-e2e-'));
  // A dev server URL in the environment would make the app skip app://.
  const { ELECTRON_RENDERER_URL: _dev, ...env } = process.env;
  const app = await _electron.launch({
    args: [appDir, '--lang=en-US', `--user-data-dir=${userData}`],
    cwd: appDir,
    env: env as Record<string, string>,
  });
  const page = await app.firstWindow();
  return {
    app,
    page,
    userData,
    close: async () => {
      await app.close();
      rmSync(userData, { recursive: true, force: true });
    },
  };
}
