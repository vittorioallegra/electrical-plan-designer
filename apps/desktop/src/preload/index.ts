import { contextBridge } from 'electron';
import type { EpdBridge } from '@epd/bridge/bridge';

// Empty for now: later steps add typed calls, each one an `ipcRenderer.invoke` on a channel.
const bridge: EpdBridge = {};

contextBridge.exposeInMainWorld('epd', bridge);
