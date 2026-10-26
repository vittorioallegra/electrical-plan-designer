import { afterEach, describe, expect, it, vi } from 'vitest';
import { createBrowserFileAccess } from './fileAccess';

afterEach(() => vi.restoreAllMocks());

describe('browser file access without the File System Access API', () => {
  // protects=Firefox/Safari fallback; fails_when=opening does not read the chosen file, cancelling hangs, or saving does not download the file; no_claim=Chromium pickers (E2E)
  it('opens through a file input and saves by downloading', async () => {
    const access = createBrowserFileAccess();
    expect(access.canOverwrite).toBe(false);
    const file = new File([new Uint8Array([7, 8])], 'house.epd');
    const click = vi
      .spyOn(HTMLInputElement.prototype, 'click')
      .mockImplementationOnce(function (this: HTMLInputElement) {
        Object.defineProperty(this, 'files', { value: [file] });
        this.dispatchEvent(new Event('change'));
      })
      .mockImplementationOnce(function (this: HTMLInputElement) {
        this.dispatchEvent(new Event('cancel'));
      });
    const picked = await access.open();
    expect(picked?.file).toEqual({ name: 'house.epd', handle: null });
    expect([...picked!.bytes]).toEqual([7, 8]);
    expect(await access.open()).toBeNull();
    expect(click).toHaveBeenCalledTimes(2);

    const anchor = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    URL.createObjectURL ??= () => 'blob:x';
    URL.revokeObjectURL ??= () => undefined;
    const saved = await access.saveAs(new Uint8Array([1]), 'Casa.epd');
    expect(saved).toEqual({ name: 'Casa.epd', handle: null });
    expect(anchor).toHaveBeenCalledTimes(1);
    expect((anchor.mock.contexts[0] as HTMLAnchorElement).download).toBe('Casa.epd');
    expect(await access.recent()).toEqual([]);
  });
});
