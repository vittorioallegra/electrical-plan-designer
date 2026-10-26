import { describe, expect, it } from 'vitest';
import {
  InvalidArgument,
  isAllowedUrl,
  parseCloseChoice,
  parseExportArgs,
  parseRecoverySaveArgs,
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

describe('recovery copy arguments', () => {
  const meta = {
    file: null,
    savedToFile: false,
    savedAt: '2026-10-26T10:00:00Z',
    assets: [{ id: 'bg_1', mimeType: 'image/png' }],
  };

  // protects=recovery IPC validation; fails_when=an asset id that escapes the assets folder, bytes for an unlisted asset or a relative bound path is accepted; no_claim=the stored format
  it('accepts a well-formed copy and refuses path tricks', () => {
    const ok = parseRecoverySaveArgs([
      { project: '{}', meta, newAssets: [{ id: 'bg_1', bytes: new Uint8Array(2) }] },
    ]);
    expect(ok.newAssets).toHaveLength(1);
    const bad = (value: unknown) =>
      expect(() => parseRecoverySaveArgs([value])).toThrow(InvalidArgument);
    bad({
      project: '{}',
      meta: { ...meta, assets: [{ id: '../x', mimeType: 'image/png' }] },
      newAssets: [],
    });
    bad({ project: '{}', meta, newAssets: [{ id: 'other', bytes: new Uint8Array(1) }] });
    bad({
      project: '{}',
      meta: { ...meta, file: { path: 'rel.epd', name: 'a', stat: { mtimeMs: 1, size: 1 } } },
      newAssets: [],
    });
    bad({ project: 5, meta, newAssets: [] });
  });
});
