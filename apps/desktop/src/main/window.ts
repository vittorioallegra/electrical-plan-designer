import { join } from 'node:path';
import { BrowserWindow, session } from 'electron';
import { APP_ORIGIN, APP_SCHEME } from './appProtocol';

/** The page the window loads: the Vite dev server in dev, the app scheme otherwise. */
export function rendererUrl(): string {
  return process.env['ELECTRON_RENDERER_URL'] || `${APP_ORIGIN}/`;
}

/** Only the app's own origin may be navigated to; everything else is dropped. */
function isAllowedUrl(url: string, origin: string): boolean {
  try {
    return new URL(url).origin === origin;
  } catch {
    return false;
  }
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
  const origin = new URL(url).origin;
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
    title: 'Electrical Plan Designer',
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
  win.once('ready-to-show', () => win.show());

  void win.loadURL(url);
  return win;
}
