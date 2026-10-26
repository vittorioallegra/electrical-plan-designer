import { describe, expect, it } from 'vitest';
import {
  InvalidArgument,
  isAllowedUrl,
  parseCloseChoice,
  parseExportArgs,
  parseSaveArgs,
  parseSaveAsArgs,
  parseWindowState,
} from './ipcValidation';

const stat = { mtimeMs: 1, size: 2 };

describe('ipc validation', () => {
  // protects=main never acts on malformed renderer input; fails_when=a relative path, non-bytes, a bad stat or a folder in a file name is accepted; no_claim=that the path was handed out (the file service checks)
  it('rejects malformed save, save-as and export arguments', () => {
    expect(parseSaveArgs(['/tmp/a.epd', new Uint8Array(1), stat]).expected).toEqual(stat);
    expect(parseSaveArgs(['/tmp/a.epd', new Uint8Array(1), null]).expected).toBeNull();
    for (const args of [
      ['a.epd', new Uint8Array(1), null],
      ['/tmp/a\0.epd', new Uint8Array(1), null],
      ['/tmp/a.epd', [1, 2], null],
      ['/tmp/a.epd', new Uint8Array(1), { mtimeMs: 'x', size: 1 }],
      ['/tmp/a.epd', new Uint8Array(1)],
      [42, new Uint8Array(1), null],
    ])
      expect(() => parseSaveArgs(args)).toThrow(InvalidArgument);

    expect(parseSaveAsArgs(['House.epd', new Uint8Array(1)]).suggestedName).toBe('House.epd');
    for (const name of ['../x.epd', 'a/b.epd', 'a\\b.epd', '', '..'])
      expect(() => parseSaveAsArgs([name, new Uint8Array(1)])).toThrow(InvalidArgument);

    const filters = [{ name: 'PDF', extensions: ['pdf'] }];
    expect(parseExportArgs(['a.pdf', new Uint8Array(1), filters]).filters).toEqual(filters);
    expect(() =>
      parseExportArgs(['a.pdf', new Uint8Array(1), [{ name: 'x', extensions: ['*'] }]]),
    ).toThrow(InvalidArgument);
    expect(() => parseExportArgs(['a.pdf', new Uint8Array(1), 'pdf'])).toThrow(InvalidArgument);
  });

  // protects=window messages; fails_when=a state without a boolean, a choice other than close/cancel, or a foreign origin is accepted; no_claim=the trusted-sender check on the Electron event (E2E)
  it('validates window state, the close choice and the sender origin', () => {
    expect(parseWindowState({ name: 'House', unsaved: true })).toEqual({
      name: 'House',
      unsaved: true,
    });
    expect(parseWindowState({ name: null, unsaved: false }).name).toBeNull();
    expect(() => parseWindowState({ name: 'x', unsaved: 'yes' })).toThrow(InvalidArgument);
    expect(() => parseWindowState(null)).toThrow(InvalidArgument);
    expect(parseCloseChoice('close')).toBe('close');
    expect(() => parseCloseChoice('quit')).toThrow(InvalidArgument);
    expect(isAllowedUrl('app://epd/project/plan', 'app://epd')).toBe(true);
    expect(isAllowedUrl('https://example.com/', 'app://epd')).toBe(false);
    expect(isAllowedUrl('not a url', 'app://epd')).toBe(false);
  });
});
