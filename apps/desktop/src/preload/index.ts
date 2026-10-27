import { contextBridge, ipcRenderer } from 'electron';
import { channels, type EpdBridge } from '@epd/bridge/bridge';

// Every call is an `ipcRenderer.invoke` (or `send`) on a channel from @epd/bridge; main validates
// the sender and every argument.
const bridge: EpdBridge = {
  platform:
    process.platform === 'darwin' || process.platform === 'win32' ? process.platform : 'linux',
  files: {
    open: () => ipcRenderer.invoke(channels.filesOpen),
    save: (path, bytes, expected) => ipcRenderer.invoke(channels.filesSave, path, bytes, expected),
    openPath: (path) => ipcRenderer.invoke(channels.filesOpenPath, path),
    onOpenRequest: (listener) => {
      const handler = (_event: unknown, path: string) => listener(path);
      ipcRenderer.on(channels.openRequest, handler);
      // Subscribing is the "ready" signal: requests that came at launch are sent now.
      ipcRenderer.send(channels.openRequestReady);
      return () => ipcRenderer.removeListener(channels.openRequest, handler);
    },
    saveAs: (suggestedName, bytes) =>
      ipcRenderer.invoke(channels.filesSaveAs, suggestedName, bytes),
    exportFile: (name, bytes, filters) =>
      ipcRenderer.invoke(channels.filesExport, name, bytes, filters),
    openImport: (filters) => ipcRenderer.invoke(channels.filesOpenImport, filters),
  },
  recent: {
    list: () => ipcRenderer.invoke(channels.recentList),
    remove: (path) => ipcRenderer.invoke(channels.recentRemove, path),
  },
  menu: {
    setLabels: (labels) => ipcRenderer.send(channels.menuLabels, labels),
    onCommand: (listener) => {
      const handler = (_event: unknown, command: Parameters<typeof listener>[0]) =>
        listener(command);
      ipcRenderer.on(channels.menuCommand, handler);
      return () => ipcRenderer.removeListener(channels.menuCommand, handler);
    },
  },
  recovery: {
    save: (args) => ipcRenderer.invoke(channels.recoverySave, args),
    load: () => ipcRenderer.invoke(channels.recoveryLoad),
    clear: () => ipcRenderer.invoke(channels.recoveryClear),
  },
  library: {
    load: () => ipcRenderer.invoke(channels.libraryLoad),
    saveCore: (core) => ipcRenderer.invoke(channels.librarySaveCore, core),
    saveCatalog: (catalog) => ipcRenderer.invoke(channels.librarySaveCatalog, catalog),
    removeCatalog: (id) => ipcRenderer.invoke(channels.libraryRemoveCatalog, id),
    setLogo: (logo) => ipcRenderer.invoke(channels.librarySetLogo, logo),
    replace: (replacement) => ipcRenderer.invoke(channels.libraryReplace, replacement),
  },
  preferences: {
    getTheme: () => ipcRenderer.invoke(channels.preferencesGetTheme),
    setTheme: (theme) => ipcRenderer.invoke(channels.preferencesSetTheme, theme),
    onThemeChanged: (listener) => {
      const handler = (_event: unknown, theme: Parameters<typeof listener>[0]) => listener(theme);
      ipcRenderer.on(channels.preferencesThemeChanged, handler);
      return () => ipcRenderer.removeListener(channels.preferencesThemeChanged, handler);
    },
  },
  window: {
    setState: (state) => ipcRenderer.send(channels.windowState, state),
    onCloseRequested: (listener) => {
      const handler = () => listener();
      ipcRenderer.on(channels.closeRequested, handler);
      return () => ipcRenderer.removeListener(channels.closeRequested, handler);
    },
    ackClose: () => ipcRenderer.send(channels.closeAck),
    answerClose: (choice) => ipcRenderer.send(channels.closeAnswer, choice),
    isFullScreen: () => ipcRenderer.invoke(channels.windowIsFullScreen),
    onFullScreenChange: (listener) => {
      const handler = (_event: unknown, fullScreen: boolean) => listener(fullScreen);
      ipcRenderer.on(channels.windowFullScreen, handler);
      return () => ipcRenderer.removeListener(channels.windowFullScreen, handler);
    },
  },
};

contextBridge.exposeInMainWorld('epd', bridge);
