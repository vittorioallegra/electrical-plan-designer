// The app window. The desktop app reports the project's name and unsaved state to main (title,
// document-edited dot) and answers its close requests; a fake stands in for tests and browsers.
import type { EpdBridge } from '@epd/bridge/bridge';
import type { CloseChoice, WindowHost, WindowState } from './types';

export function createDesktopWindowHost(window: EpdBridge['window']): WindowHost {
  return {
    setState: (state) => window.setState(state),
    onCloseRequested: (listener) =>
      window.onCloseRequested(() => {
        // Tell main this page is alive and asking, so it waits for the user.
        window.ackClose();
        listener();
      }),
    answerClose: (choice) => window.answerClose(choice),
  };
}

export interface MemoryWindowHost extends WindowHost {
  /** The last state reported, null before the first report. */
  state: WindowState | null;
  /** Answers given, in order. */
  answers: CloseChoice[];
  /** Simulates main asking to close the window. */
  requestClose(): void;
}

export function createMemoryWindowHost(): MemoryWindowHost {
  const listeners = new Set<() => void>();
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
  };
  return host;
}
