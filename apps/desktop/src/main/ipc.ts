// IPC handlers. Every one checks the sender (the app's own window, its main frame, the app's
// origin) and validates every argument before touching the disk or a window.
import { join } from 'node:path';
import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  type IpcMainEvent,
  type IpcMainInvokeEvent,
} from 'electron';
import { channels } from '@epd/bridge/bridge';
import { createRecoveryService, type RecoveryService } from './recovery';
import { createFileService, type FileDialogs, type FileService } from './files';
import {
  isAllowedUrl,
  parseCloseChoice,
  parseExportArgs,
  parseRecoverySaveArgs,
  parseSaveArgs,
  parseSaveAsArgs,
  parseWindowState,
} from './ipcValidation';
import { windowContexts } from './window';
import { windowTitle } from './windowTitle';

const dialogs: FileDialogs<BrowserWindow> = {
  async chooseFileToOpen(win) {
    const result = await dialog.showOpenDialog(win, {
      properties: ['openFile'],
      filters: [{ name: 'Electrical Plan Designer', extensions: ['epd'] }],
    });
    return result.canceled ? null : (result.filePaths[0] ?? null);
  },
  async chooseFileToSave(win, { defaultName, filters }) {
    const result = await dialog.showSaveDialog(win, { defaultPath: defaultName, filters });
    return result.canceled || !result.filePath ? null : result.filePath;
  },
};

/** The window a message comes from, or null when the sender is not the app's own page. */
function trustedWindow(event: IpcMainEvent | IpcMainInvokeEvent): BrowserWindow | null {
  const win = BrowserWindow.fromWebContents(event.sender);
  const context = win ? windowContexts.get(win) : undefined;
  const frame = event.senderFrame;
  if (!win || !context || !frame || frame !== win.webContents.mainFrame) return null;
  return isAllowedUrl(frame.url, context.origin) ? win : null;
}

function invoke<T>(
  channel: string,
  handler: (win: BrowserWindow, args: unknown[]) => Promise<T> | T,
): void {
  ipcMain.handle(channel, (event, ...args: unknown[]) => {
    const win = trustedWindow(event);
    if (!win) throw new Error('untrusted sender');
    return handler(win, args);
  });
}

function on(channel: string, handler: (win: BrowserWindow, args: unknown[]) => void): void {
  ipcMain.on(channel, (event, ...args: unknown[]) => {
    const win = trustedWindow(event);
    if (!win) return;
    try {
      handler(win, args);
    } catch (error) {
      console.error(`ignored invalid ${channel} message`, error);
    }
  });
}

/** The file service the handlers use; exported so later steps allow paths (recent, OS open). */
export let files: FileService<BrowserWindow>;

/** The recovery copy of the open project, in the app data folder. */
export let recovery: RecoveryService;

export function registerIpc(): void {
  files = createFileService<BrowserWindow>({ dialogs });
  recovery = createRecoveryService({
    dir: join(app.getPath('userData'), 'recovery'),
    isAllowedPath: (path) => files.isAllowed(path),
    allowPath: (path) => files.allow(path),
  });

  invoke(channels.filesOpen, (win) => files.open(win));
  invoke(channels.filesSave, (_win, args) => {
    const { path, bytes, expected } = parseSaveArgs(args);
    return files.save(path, bytes, expected);
  });
  invoke(channels.filesSaveAs, (win, args) => {
    const { suggestedName, bytes } = parseSaveAsArgs(args);
    return files.saveAs(win, suggestedName, bytes);
  });
  invoke(channels.filesExport, (win, args) => {
    const { name, bytes, filters } = parseExportArgs(args);
    return files.exportFile(win, name, bytes, filters);
  });

  invoke(channels.recoverySave, (_win, args) => recovery.save(parseRecoverySaveArgs(args)));
  invoke(channels.recoveryLoad, () => recovery.load());
  invoke(channels.recoveryClear, () => recovery.clear());

  on(channels.windowState, (win, [value]) => {
    const state = parseWindowState(value);
    windowContexts.get(win)?.guard.setUnsaved(state.unsaved);
    win.setTitle(windowTitle(state.name, state.unsaved, process.platform));
    if (process.platform === 'darwin') win.setDocumentEdited(state.unsaved);
  });
  on(channels.closeAck, (win) => windowContexts.get(win)?.guard.ack());
  on(channels.closeAnswer, (win, [choice]) => {
    windowContexts.get(win)?.guard.answer(parseCloseChoice(choice));
  });
}
