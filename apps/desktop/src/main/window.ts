import { join } from 'node:path';
import { BrowserWindow, session } from 'electron';
import { channels } from '@epd/bridge/bridge';
import { APP_ORIGIN, APP_SCHEME } from './appProtocol';
import { lifecycle } from './lifecycle';
import { createCloseGuard, type CloseGuard } from './closeGuard';
import { isAllowedUrl, originOf } from './ipcValidation';
import { APP_NAME } from './windowTitle';

/** What main keeps per window: the origin its renderer must come from and its close guard. */
export interface WindowContext {
  origin: string;
  guard: CloseGuard;
}

export const windowContexts = new WeakMap<BrowserWindow, WindowContext>();

/** The page the window loads: the Vite dev server in dev, the app scheme otherwise. */
export function rendererUrl(): string {
  return process.env['ELECTRON_RENDERER_URL'] || `${APP_ORIGIN}/`;
}

/** In production nothing may leave the app scheme (data: and blob: are in-page only). */
function blockForeignRequests(): void {
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    const protocolName = new URL(details.url).protocol.replace(':', '');
    callback({ cancel: !['data', 'blob', 'devtools', APP_SCHEME].includes(protocolName) });
  });
}

export function createWindow(): BrowserWindow {
  const url = rendererUrl();
  const origin = originOf(url);
  if (url.startsWith(`${APP_SCHEME}:`)) blockForeignRequests();
  session.defaultSession.setPermissionRequestHandler((_wc, _permission, callback) =>
    callback(false),
  );

  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    show: false,
    title: APP_NAME,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });

  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (event, target) => {
    if (!isAllowedUrl(target, origin)) event.preventDefault();
  });
  win.webContents.on('will-attach-webview', (event) => event.preventDefault());
  const guard = createCloseGuard({
    askRenderer: () => win.webContents.send(channels.closeRequested),
    closeWindow: () => win.close(),
    onCancel: () => {
      lifecycle.quitting = false;
    },
  });
  // A crashed or reloaded page can no longer answer the close question.
  win.webContents.on('render-process-gone', () => guard.rendererLost());
  win.webContents.on('did-start-navigation', (_event, _url, isInPlace, isMainFrame) => {
    if (isMainFrame && !isInPlace) guard.rendererLost();
  });
  windowContexts.set(win, { origin, guard });
  win.on('close', (event) => guard.onClose(event));
  // The title is the project name and the unsaved marker (set from the renderer), not the page's.
  win.on('page-title-updated', (event) => event.preventDefault());
  win.once('ready-to-show', () => win.show());

  void win.loadURL(url);
  return win;
}
