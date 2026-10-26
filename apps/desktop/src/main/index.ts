import { join } from 'node:path';
import { app, BrowserWindow } from 'electron';
import { registerAppScheme, serveRenderer } from './appProtocol';
import { createWindow } from './window';

registerAppScheme();

void app.whenReady().then(() => {
  // In dev the renderer comes from the Vite dev server; otherwise from the built files.
  if (!process.env['ELECTRON_RENDERER_URL']) serveRenderer(join(__dirname, '../renderer'));
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
