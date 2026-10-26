import { afterEach, describe, expect, it, vi } from 'vitest';
import { createBrowserFileAccess } from './fileAccess';

afterEach(() => vi.restoreAllMocks());

describe('browser file access', () => {
  // protects=one behavior on every browser; fails_when=opening does not read the chosen file, cancelling hangs, or saving does not download the file under its name; no_claim=browser download settings
  it('opens through a file input and saves by downloading', async () => {
    const access = createBrowserFileAccess();
    const file = new File([new Uint8Array([7, 8])], 'house.epd');
    vi.spyOn(HTMLInputElement.prototype, 'click')
      .mockImplementationOnce(function (this: HTMLInputElement) {
        Object.defineProperty(this, 'files', { value: [file] });
        this.dispatchEvent(new Event('change'));
      })
      .mockImplementationOnce(function (this: HTMLInputElement) {
        this.dispatchEvent(new Event('cancel'));
      });
    const picked = await access.open();
    expect(picked?.name).toBe('house.epd');
    expect([...picked!.bytes]).toEqual([7, 8]);
    expect(await access.open()).toBeNull();

    const anchor = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    URL.createObjectURL ??= () => 'blob:x';
    URL.revokeObjectURL ??= () => undefined;
    access.download(new Uint8Array([1]), 'Casa.epd');
    expect(anchor).toHaveBeenCalledTimes(1);
    expect((anchor.mock.contexts[0] as HTMLAnchorElement).download).toBe('Casa.epd');
  });
});
