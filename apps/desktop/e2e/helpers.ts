import { chmodSync, copyFileSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { strFromU8, unzipSync } from 'fflate';
import { _electron, expect, type ElectronApplication, type Page } from '@playwright/test';

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
      // A test may have quit the app already.
      if (app.process().exitCode === null && app.process().signalCode === null) await app.close();
      rmSync(userData, { recursive: true, force: true });
    },
  };
}

/** Copies the demo project into a fresh temp folder; returns the folder and the file's path. */
export function tempProject(): { dir: string; path: string; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), 'epd-project-'));
  const path = join(dir, 'house.epd');
  copyFileSync(join(appDir, '../../tests/fixtures/demo-project.epd'), path);
  return {
    dir,
    path,
    cleanup: () => {
      chmodSync(dir, 0o755);
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

/** The native open dialog picks `path` (dialogs cannot be driven from the page). */
export async function stubOpenDialog(app: ElectronApplication, path: string): Promise<void> {
  await app.evaluate(({ dialog }, p) => {
    dialog.showOpenDialog = (async () => ({ canceled: false, filePaths: [p] })) as never;
  }, path);
}

/** The native save dialog picks `path`. */
export async function stubSaveDialog(app: ElectronApplication, path: string): Promise<void> {
  await app.evaluate(({ dialog }, p) => {
    dialog.showSaveDialog = (async () => ({ canceled: false, filePath: p })) as never;
  }, path);
}

/** Floors in the project of an `.epd` file. */
export function floorCount(path: string): number {
  const files = unzipSync(new Uint8Array(readFileSync(path)));
  const project = JSON.parse(strFromU8(files['project.json']!)) as {
    doc: { floors: unknown[] };
  };
  return project.doc.floors.length;
}

/** Opens `path` through the start screen's "Open file…". */
export async function openProjectFile(launched: LaunchedApp, path: string): Promise<void> {
  await stubOpenDialog(launched.app, path);
  await launched.page.getByRole('button', { name: 'Open file…' }).click();
  await expect(launched.page.getByTestId('project-name')).toHaveText('Demo house');
}

export async function windowTitle(app: ElectronApplication): Promise<string> {
  return app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.getTitle());
}
