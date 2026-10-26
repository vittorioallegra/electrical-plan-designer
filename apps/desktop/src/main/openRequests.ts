// Project files the OS asks the app to open (double-click, a second launch, a path on the command
// line). A request that arrives before the page is ready (at launch) waits until it is. No
// Electron imports: tested in plain Node.
import { isAbsolute, resolve } from 'node:path';

export interface OpenRequests {
  /** A file to open: allowed for Save, then sent to the page (or kept until it is ready). */
  push(path: string): void;
  /** The page can take requests now: the waiting ones are sent. */
  ready(): void;
  /** The page is gone or reloading: requests wait again. */
  reset(): void;
}

export function createOpenRequests({
  send,
  allow,
}: {
  send(path: string): void;
  allow(path: string): void;
}): OpenRequests {
  let isReady = false;
  let waiting: string[] = [];
  return {
    push(path) {
      allow(path);
      if (isReady) send(path);
      else waiting.push(path);
    },
    ready() {
      isReady = true;
      const queued = waiting;
      waiting = [];
      queued.forEach(send);
    },
    reset() {
      isReady = false;
    },
  };
}

/** The `.epd` paths in a command line; relative ones are resolved against `cwd`. */
export function epdPathsFromArgv(argv: string[], cwd: string): string[] {
  return argv
    .filter((arg) => !arg.startsWith('-') && arg.toLowerCase().endsWith('.epd'))
    .map((arg) => (isAbsolute(arg) ? arg : resolve(cwd, arg)));
}
