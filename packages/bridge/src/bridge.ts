/**
 * The IPC contract between the Electron main process, the preload script and the web app.
 * Types and channel names only: no runtime code, no imports from the app.
 */

/** The API the preload script exposes to the renderer as `window.epd`. Grows with each step. */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface EpdBridge {}

/** IPC channel names shared by main and preload. Grows with each step. */
export const channels = {} as const;

declare global {
  interface Window {
    /** Present only inside the desktop app. */
    epd?: EpdBridge;
  }
}
