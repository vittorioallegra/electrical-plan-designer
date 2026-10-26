// The app window. The desktop app reports the project's name and unsaved state to main (title,
// document-edited dot) and answers its close requests; a fake stands in for tests and browsers.
import type { EpdBridge } from '@epd/bridge/bridge';
import type { CloseChoice, MenuCommand, MenuLabels, WindowHost, WindowState } from './types';

export function createDesktopWindowHost(
  window: EpdBridge['window'],
  menu: EpdBridge['menu'],
  files: EpdBridge['files'],
): WindowHost {
  return {
    setState: (state) => window.setState(state),
    onCloseRequested: (listener) =>
      window.onCloseRequested(() => {
        // Tell main this page is alive and asking, so it waits for the user.
        window.ackClose();
        listener();
      }),
    answerClose: (choice) => window.answerClose(choice),
    setMenuLabels: (labels) => menu.setLabels(labels),
    onMenuCommand: (listener) => menu.onCommand(listener),
    onOpenRequest: (listener) => files.onOpenRequest(listener),
  };
}

export interface MemoryWindowHost extends WindowHost {
  /** The last state reported, null before the first report. */
  state: WindowState | null;
  /** Answers given, in order. */
  answers: CloseChoice[];
  /** Simulates main asking to close the window. */
  requestClose(): void;
  /** The last menu labels set, null before the first. */
  menuLabels: MenuLabels | null;
  /** Simulates the user choosing a menu item. */
  menuCommand(command: MenuCommand): void;
  /** Simulates the OS asking to open a file. */
  openRequest(path: string): void;
}

export function createMemoryWindowHost(): MemoryWindowHost {
  const listeners = new Set<() => void>();
  const commands = new Set<(command: MenuCommand) => void>();
  const requests = new Set<(path: string) => void>();
  const host: MemoryWindowHost = {
    state: null,
    answers: [],
    setState: (state) => void (host.state = state),
    onCloseRequested(listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    answerClose: (choice) => void host.answers.push(choice),
    requestClose: () => listeners.forEach((listener) => listener()),
    menuLabels: null,
    setMenuLabels: (labels) => void (host.menuLabels = labels),
    onMenuCommand(listener) {
      commands.add(listener);
      return () => void commands.delete(listener);
    },
    menuCommand: (command) => commands.forEach((listener) => listener(command)),
    onOpenRequest(listener) {
      requests.add(listener);
      return () => void requests.delete(listener);
    },
    openRequest: (path) => requests.forEach((listener) => listener(path)),
  };
  return host;
}
