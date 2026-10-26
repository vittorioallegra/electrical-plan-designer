import { join } from 'node:path';
import { app, BrowserWindow } from 'electron';
import { registerAppScheme, serveRenderer } from './appProtocol';
import { registerIpc } from './ipc';
import { lifecycle } from './lifecycle';
import { createWindow } from './window';

registerAppScheme();

void app.whenReady().then(() => {
  // In dev the renderer comes from the Vite dev server; otherwise from the built files.
  if (!process.env['ELECTRON_RENDERER_URL']) serveRenderer(join(__dirname, '../renderer'));
  registerIpc();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Quitting closes every window (each may ask about unsaved changes first); once they are all
// closed a quit goes on, also on macOS where closing the last window alone does not quit.
app.on('before-quit', () => {
  lifecycle.quitting = true;
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' || lifecycle.quitting) app.quit();
});
