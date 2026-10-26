import { contextBridge, ipcRenderer } from 'electron';
import { channels, type EpdBridge } from '@epd/bridge/bridge';

// Every call is an `ipcRenderer.invoke` (or `send`) on a channel from @epd/bridge; main validates
// the sender and every argument.
const bridge: EpdBridge = {
  files: {
    open: () => ipcRenderer.invoke(channels.filesOpen),
    save: (path, bytes, expected) => ipcRenderer.invoke(channels.filesSave, path, bytes, expected),
    saveAs: (suggestedName, bytes) =>
      ipcRenderer.invoke(channels.filesSaveAs, suggestedName, bytes),
    exportFile: (name, bytes, filters) =>
      ipcRenderer.invoke(channels.filesExport, name, bytes, filters),
  },
  recovery: {
    save: (args) => ipcRenderer.invoke(channels.recoverySave, args),
    load: () => ipcRenderer.invoke(channels.recoveryLoad),
    clear: () => ipcRenderer.invoke(channels.recoveryClear),
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
  },
};

contextBridge.exposeInMainWorld('epd', bridge);
