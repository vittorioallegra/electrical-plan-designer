import { join } from 'node:path';
import { app, BrowserWindow } from 'electron';
import { registerAppScheme, serveRenderer } from './appProtocol';
import { appMenu, openFileFromOs, openRequests, registerIpc } from './ipc';
import { lifecycle } from './lifecycle';
import { epdPathsFromArgv } from './openRequests';
import { createWindow } from './window';

registerAppScheme();

/**
 * A window whose page is not ready yet holds open requests back (also after a reload). Only a
 * main frame navigation resets it: `did-start-loading` also fires for loads that do not unload
 * the page, which would leave the page "not ready" for good.
 */
function openWindow(): BrowserWindow {
  const win = createWindow();
  win.webContents.on('did-start-navigation', (details) => {
    if (details.isMainFrame && !details.isSameDocument) {
      openRequests.reset();
    }
  });
  return win;
}

/** Brings the window forward (restoring it when minimized) so an opened file is seen. */
function showWindow(): void {
  const win = BrowserWindow.getAllWindows()[0];
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.focus();
}

function openFromCommandLine(argv: string[], cwd: string): void {
  // One project is open at a time: only the first file counts.
  const [path] = epdPathsFromArgv(argv, cwd);
  if (path) openFileFromOs(path);
}

// One instance: a second launch (e.g. a double-click on a `.epd` on Windows) hands its file to
// the first one and exits.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  openFromCommandLine(process.argv.slice(1), process.cwd());

  app.on('second-instance', (_event, argv, cwd) => {
    openFromCommandLine(argv.slice(1), cwd);
    showWindow();
  });

  // macOS sends the file this way, also at launch (before `ready`).
  app.on('open-file', (event, path) => {
    event.preventDefault();
    openFileFromOs(path);
    if (app.isReady() && BrowserWindow.getAllWindows().length === 0) openWindow();
    showWindow();
  });

  void app.whenReady().then(() => {
    // In dev the renderer comes from the Vite dev server; otherwise from the built files.
    if (!process.env['ELECTRON_RENDERER_URL']) serveRenderer(join(__dirname, '../renderer'));
    registerIpc();
    openWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) openWindow();
    });
    // A file may have appeared or vanished since the menu was built.
    app.on('browser-window-focus', () => void appMenu.refresh());
  });

  // Quitting closes every window (each may ask about unsaved changes first); once they are all
  // closed a quit goes on, also on macOS where closing the last window alone does not quit.
  app.on('before-quit', () => {
    lifecycle.quitting = true;
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin' || lifecycle.quitting) app.quit();
  });
}
