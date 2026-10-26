// Closing or quitting with unsaved changes: main holds the close, asks the renderer and closes
// when the answer is "close". A renderer that does not even acknowledge the request (hung,
// crashed) must not make the window unclosable, so main closes anyway after a timeout; the
// recovery copy keeps the changes. The same holds after the acknowledgement: a renderer that
// crashes or reloads (the question is gone) closes the window, and a long backstop timeout
// covers a renderer that hangs with the question open.

export interface CloseGuard {
  /** The renderer reports whether the open project has changes that are not in its file. */
  setUnsaved(unsaved: boolean): void;
  /** Call from the window's `close` event; prevents it while the user is being asked. */
  onClose(event: { preventDefault(): void }): void;
  /** The renderer got the request and shows the question: wait for the user. */
  ack(): void;
  /** The user's answer. */
  answer(choice: 'close' | 'cancel'): void;
  /** The renderer crashed or navigated away: the question is gone, close if one was pending. */
  rendererLost(): void;
}

export function createCloseGuard({
  askRenderer,
  closeWindow,
  onCancel,
  ackTimeoutMs = 3000,
  answerTimeoutMs = 10 * 60_000,
}: {
  askRenderer(): void;
  closeWindow(): void;
  /** The user kept the window open (e.g. a quit that was in progress is over). */
  onCancel?(): void;
  ackTimeoutMs?: number;
  /** Backstop after the acknowledgement; long, as a person may take their time to answer. */
  answerTimeoutMs?: number;
}): CloseGuard {
  let unsaved = false;
  let asking = false;
  let allowClose = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  function closeAnyway() {
    clearTimeout(timer);
    asking = false;
    allowClose = true;
    closeWindow();
  }

  return {
    setUnsaved(value) {
      unsaved = value;
    },
    onClose(event) {
      if (allowClose || !unsaved) return;
      event.preventDefault();
      if (asking) return;
      asking = true;
      askRenderer();
      timer = setTimeout(closeAnyway, ackTimeoutMs);
    },
    ack() {
      clearTimeout(timer);
      if (asking) timer = setTimeout(closeAnyway, answerTimeoutMs);
    },
    rendererLost() {
      if (asking) closeAnyway();
    },
    answer(choice) {
      if (!asking) return;
      if (choice === 'close') closeAnyway();
      else {
        clearTimeout(timer);
        asking = false;
        onCancel?.();
      }
    },
  };
}
