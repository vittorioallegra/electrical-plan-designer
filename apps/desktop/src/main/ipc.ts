// IPC handlers. Every one checks the sender (the app's own window, its main frame, the app's
// origin) and validates every argument before touching the disk or a window.
import { join } from 'node:path';
import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  nativeTheme,
  type IpcMainEvent,
  type IpcMainInvokeEvent,
} from 'electron';
import { channels, type MenuCommand } from '@epd/bridge/bridge';
import { createAppMenu, type AppMenu } from './appMenu';
import { createOpenRequests, type OpenRequests } from './openRequests';
import { createRecentService, type RecentService } from './recent';
import { createLibraryService, type LibraryService } from './library';
import { createPreferencesService, type PreferencesService } from './preferences';
import { createRecoveryService, type RecoveryService } from './recovery';
import { createFileService, type FileDialogs, type FileService } from './files';
import {
  isAllowedUrl,
  parseCloseChoice,
  parseExportArgs,
  parseLibraryLogo,
  parseLibraryReplacement,
  parseMenuLabels,
  parsePathArg,
  parseRecoverySaveArgs,
  parseSaveArgs,
  parseSaveAsArgs,
  parseThemePreference,
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

/** The library (company, catalogs, prices, presets, defaults) in the app data folder. */
export let library: LibraryService;

/** The app preferences (theme) in the app data folder. */
export let preferences: PreferencesService;

/** The recent project files and the application menu built from them. */
export let recent: RecentService;
export let appMenu: AppMenu;

/** Files the OS asked to open; they wait for the page when it is not ready yet. */
export let openRequests: OpenRequests;
const early: string[] = [];

/** The app's window (there is one), or undefined. */
function mainWindow(): BrowserWindow | undefined {
  return BrowserWindow.getAllWindows()[0];
}

/**
 * A project file the OS asks to open (double-click, a second launch, argv). Safe to call before
 * the app is ready: the request is kept until the handlers exist.
 */
export function openFileFromOs(path: string): void {
  if (openRequests) openRequests.push(path);
  else early.push(path);
}

/**
 * Reads the preferences and applies the theme to `nativeTheme` (so the CSS media query, native
 * menus and dialogs follow). Call before the first window is created. The theme is applied again
 * on every change, and every open window is told about it.
 */
export async function initPreferences(): Promise<void> {
  preferences = createPreferencesService({
    file: join(app.getPath('userData'), 'preferences.json'),
  });
  await preferences.load();
  nativeTheme.themeSource = preferences.theme();
  preferences.onThemeChange((theme) => {
    nativeTheme.themeSource = theme;
    for (const win of BrowserWindow.getAllWindows())
      win.webContents.send(channels.preferencesThemeChanged, theme);
  });
}

export function registerIpc(): void {
  recent = createRecentService({ file: join(app.getPath('userData'), 'recent.json') });
  files = createFileService<BrowserWindow>({
    dialogs,
    canOpen: (path) => recent.has(path),
    onUsed: (path) => void recent.add(path),
  });
  const send = (channel: string, ...args: unknown[]) =>
    mainWindow()?.webContents.send(channel, ...args);
  appMenu = createAppMenu({
    recent,
    send: (command: MenuCommand) => send(channels.menuCommand, command),
  });
  recent.onChange(() => void appMenu.refresh());
  openRequests = createOpenRequests({
    send: (path) => send(channels.openRequest, path),
    allow: (path) => files.allow(path),
  });
  early.splice(0).forEach((path) => openRequests.push(path));
  recovery = createRecoveryService({
    dir: join(app.getPath('userData'), 'recovery'),
    isAllowedPath: (path) => files.isAllowed(path),
    allowPath: (path) => files.allow(path),
  });
  library = createLibraryService({ dir: join(app.getPath('userData'), 'library') });

  invoke(channels.filesOpen, (win) => files.open(win));
  invoke(channels.filesOpenPath, (_win, args) => files.openPath(parsePathArg(args)));
  invoke(channels.recentList, () => recent.list());
  invoke(channels.recentRemove, (_win, args) => recent.remove(parsePathArg(args)));
  on(channels.openRequestReady, () => openRequests.ready());
  on(channels.menuLabels, (_win, [labels]) => appMenu.setLabels(parseMenuLabels(labels)));
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

  invoke(channels.libraryLoad, () => library.load());
  invoke(channels.librarySaveCore, (_win, [core]) => library.saveCore(core));
  invoke(channels.librarySaveCatalog, (_win, [catalog]) => library.saveCatalog(catalog));
  invoke(channels.libraryRemoveCatalog, (_win, [id]) => library.removeCatalog(id as string));
  invoke(channels.librarySetLogo, (_win, [logo]) => library.setLogo(parseLibraryLogo(logo)));
  invoke(channels.libraryReplace, (_win, args) => library.replace(parseLibraryReplacement(args)));

  invoke(channels.preferencesGetTheme, () => preferences.theme());
  invoke(channels.preferencesSetTheme, (_win, args) =>
    preferences.setTheme(parseThemePreference(args[0])),
  );

  on(channels.windowState, (win, [value]) => {
    const state = parseWindowState(value);
    windowContexts.get(win)?.guard.setUnsaved(state.unsaved);
    appMenu.setHasProject(state.name !== null);
    win.setTitle(windowTitle(state.name, state.unsaved, process.platform));
    if (process.platform === 'darwin') win.setDocumentEdited(state.unsaved);
  });
  on(channels.closeAck, (win) => windowContexts.get(win)?.guard.ack());
  on(channels.closeAnswer, (win, [choice]) => {
    windowContexts.get(win)?.guard.answer(parseCloseChoice(choice));
  });
}
