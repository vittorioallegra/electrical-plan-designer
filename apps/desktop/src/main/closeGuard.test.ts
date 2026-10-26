import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createCloseGuard } from './closeGuard';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

function setup() {
  const askRenderer = vi.fn();
  const closeWindow = vi.fn();
  const onCancel = vi.fn();
  const guard = createCloseGuard({ askRenderer, closeWindow, onCancel, ackTimeoutMs: 1000 });
  const close = () => {
    const event = { preventDefault: vi.fn() };
    guard.onClose(event);
    return event;
  };
  return { guard, askRenderer, closeWindow, onCancel, close };
}

describe('close guard', () => {
  // protects=AC 8 quit prompt; fails_when=a project with no unsaved changes is held back, Cancel does not tell main the quit is over, one with changes closes without asking, Cancel closes it, or Close does not close; no_claim=the dialog the renderer shows
  it('asks only while there are unsaved changes and obeys the answer', () => {
    const { guard, askRenderer, closeWindow, onCancel, close } = setup();
    expect(close().preventDefault).not.toHaveBeenCalled();

    guard.setUnsaved(true);
    expect(close().preventDefault).toHaveBeenCalledTimes(1);
    expect(close().preventDefault).toHaveBeenCalledTimes(1);
    expect(askRenderer).toHaveBeenCalledTimes(1);
    guard.ack();
    guard.answer('cancel');
    expect(closeWindow).not.toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalledTimes(1);

    close();
    expect(askRenderer).toHaveBeenCalledTimes(2);
    guard.ack();
    guard.answer('close');
    expect(closeWindow).toHaveBeenCalledTimes(1);
    // The close it triggers goes through.
    expect(close().preventDefault).not.toHaveBeenCalled();
  });

  // protects=a stuck renderer cannot trap the window; fails_when=a renderer that never acknowledges keeps the window open forever, or a slow user answer after the acknowledgement is cut off; no_claim=what happens to unsaved changes (recovery copy, a later step)
  it('closes anyway when the renderer does not acknowledge, but waits for a user who does', () => {
    const { guard, closeWindow, close } = setup();
    guard.setUnsaved(true);
    close();
    vi.advanceTimersByTime(1000);
    expect(closeWindow).toHaveBeenCalledTimes(1);

    const second = setup();
    second.guard.setUnsaved(true);
    second.close();
    second.guard.ack();
    vi.advanceTimersByTime(60_000);
    expect(second.closeWindow).not.toHaveBeenCalled();
  });
});
