import { spawn, spawnSync } from 'node:child_process';
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

/**
 * Launches the built app with a fresh, temporary `userData` folder, or with `userData` of an
 * earlier launch (a relaunch); a folder passed in is left for the caller to remove.
 */
export async function launchApp(
  reuseUserData?: string,
  /** Extra command line arguments, e.g. a project file to open. */
  extraArgs: string[] = [],
): Promise<LaunchedApp> {
  const userData = reuseUserData ?? mkdtempSync(join(tmpdir(), 'epd-e2e-'));
  // A dev server URL in the environment would make the app skip app://.
  const { ELECTRON_RENDERER_URL: _dev, ...env } = process.env;
  const app = await _electron.launch({
    args: [appDir, '--lang=en-US', `--user-data-dir=${userData}`, ...extraArgs],
    cwd: appDir,
    // Playwright forces a light colour scheme by default; the app's own theme must show.
    colorScheme: null,
    // Test hooks let a test open a second window (see main/index.ts).
    env: { ...env, EPD_TEST_HOOKS: '1' } as Record<string, string>,
  });
  const page = await app.firstWindow();
  return {
    app,
    page,
    userData,
    close: async () => {
      await closeApp(app);
      if (!reuseUserData) removeDir(userData);
    },
  };
}

function running(app: ElectronApplication): boolean {
  return app.process().exitCode === null && app.process().signalCode === null;
}

/**
 * Kills the app with its child processes and waits for it to exit. On Windows a plain kill ends
 * only the main process: the GPU and renderer processes live on and keep `userData` locked.
 */
export async function killApp(app: ElectronApplication): Promise<void> {
  if (!running(app)) return;
  const child = app.process();
  const exited = new Promise<void>((resolve) => child.once('exit', () => resolve()));
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
  } else {
    child.kill('SIGKILL');
  }
  await exited;
}

/**
 * Quits the app; kills it when it does not exit within 15 s (a native dialog left open would
 * otherwise block the quit and the Playwright worker's teardown).
 */
export async function closeApp(app: ElectronApplication): Promise<void> {
  // A test may have quit the app already.
  if (!running(app)) return;
  const quit = app.close().then(
    () => true,
    () => false,
  );
  const timeout = new Promise<false>((resolve) => setTimeout(() => resolve(false), 15_000));
  if (!(await Promise.race([quit, timeout]))) await killApp(app);
}

/**
 * Removes a temporary folder. Windows refuses (EPERM, EBUSY) while a just-exited process still
 * holds a file in it, so the removal is retried for a few seconds.
 */
export function removeDir(dir: string): void {
  rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 });
}

/**
 * Starts the app a second time with the same `userData` (so the single instance lock applies) and
 * the given arguments; resolves with its exit code once it is gone.
 */
export async function launchSecondInstance(
  launched: LaunchedApp,
  extraArgs: string[],
): Promise<number | null> {
  const executable = await launched.app.evaluate(() => process.execPath);
  const { ELECTRON_RENDERER_URL: _dev, ...env } = process.env;
  const child = spawn(
    executable,
    [appDir, '--lang=en-US', `--user-data-dir=${launched.userData}`, ...extraArgs],
    { env, stdio: 'ignore' },
  );
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error('the second instance did not exit'));
    }, 30_000);
    child.once('exit', (code) => {
      clearTimeout(timer);
      resolve(code);
    });
  });
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
      removeDir(dir);
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

/** Clicks a native menu item by its labels, e.g. `clickMenu(app, 'File', 'Open…')`. */
export async function clickMenu(app: ElectronApplication, ...labels: string[]): Promise<void> {
  await app.evaluate(({ Menu }, path) => {
    let items = Menu.getApplicationMenu()?.items ?? [];
    let found: Electron.MenuItem | undefined;
    for (const label of path) {
      found = items.find((i) => i.label === label);
      if (!found) throw new Error(`no menu item ${label}`);
      items = found.submenu?.items ?? [];
    }
    found!.click();
  }, labels);
}

/** The labels of a native submenu, e.g. `menuLabels(app, 'File', 'Open Recent')`. */
export async function menuLabels(app: ElectronApplication, ...labels: string[]): Promise<string[]> {
  return app.evaluate(({ Menu }, path) => {
    let items = Menu.getApplicationMenu()?.items ?? [];
    for (const label of path) items = items.find((i) => i.label === label)?.submenu?.items ?? [];
    return items.map((i) => i.label);
  }, labels);
}

/** Whether a native menu item is enabled, e.g. `menuEnabled(app, 'File', 'Save')`. */
export async function menuEnabled(app: ElectronApplication, ...labels: string[]): Promise<boolean> {
  return app.evaluate(({ Menu }, path) => {
    let items = Menu.getApplicationMenu()?.items ?? [];
    let found: Electron.MenuItem | undefined;
    for (const label of path) {
      found = items.find((i) => i.label === label);
      items = found?.submenu?.items ?? [];
    }
    return found?.enabled ?? false;
  }, labels);
}

/**
 * Makes the app treat the window with (or without) a project as the focused one and refreshes the
 * native menu, as a real focus change does. The OS can refuse focus (a locked screen, a headless
 * session), so the menu's follow-the-focused-window logic is driven without it.
 */
export async function focusWindow(
  app: ElectronApplication,
  withProject: boolean | 'first',
): Promise<void> {
  await app.evaluate(({ app, BrowserWindow }, wanted) => {
    const pick = () => {
      const windows = BrowserWindow.getAllWindows();
      if (wanted === 'first') return windows[0] ?? null;
      return windows.find((w) => w.getTitle().includes('Demo house') === wanted) ?? null;
    };
    BrowserWindow.getFocusedWindow = pick as never;
    app.emit('browser-window-focus');
  }, withProject);
}
