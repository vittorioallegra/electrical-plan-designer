import { describe, expect, it } from 'vitest';
import { menuLabelKeys } from '@epd/bridge/bridge';
import {
  InvalidArgument,
  isAllowedUrl,
  parseCloseChoice,
  parseExportArgs,
  parseFilters,
  parseLibraryLogo,
  parseLibraryReplacement,
  parseMenuLabels,
  parsePathArg,
  parseRecoverySaveArgs,
  parseSaveArgs,
  parseSaveAsArgs,
  parseThemePreference,
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
    expect(parseFilters(filters)).toEqual(filters);
    expect(() => parseFilters([{ name: 'x', extensions: ['../x'] }])).toThrow(InvalidArgument);
  });

  // protects=window messages; fails_when=a state without a boolean, a choice other than close/cancel, or a foreign origin is accepted; no_claim=the trusted-sender check on the Electron event (E2E)
  it('validates window state, the close choice and the sender origin', () => {
    expect(parseWindowState({ name: 'House', unsaved: true, readOnly: true })).toEqual({
      name: 'House',
      unsaved: true,
      readOnly: true,
    });
    expect(parseWindowState({ name: null, unsaved: false, readOnly: false }).name).toBeNull();
    expect(() => parseWindowState({ name: 'x', unsaved: 'yes', readOnly: false })).toThrow(
      InvalidArgument,
    );
    expect(() => parseWindowState({ name: 'x', unsaved: false })).toThrow(InvalidArgument);
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

describe('menu and path arguments', () => {
  // protects=main never builds its menu from malformed text or opens a relative path; fails_when=missing, empty or non-string labels, or a relative path, are accepted; no_claim=that the path was handed out (the file service checks)
  it('validates menu labels and paths', () => {
    const labels = Object.fromEntries(menuLabelKeys.map((k) => [k, k]));
    expect(parseMenuLabels(labels).save).toBe('save');
    expect(() => parseMenuLabels({ ...labels, save: '' })).toThrow(InvalidArgument);
    expect(() => parseMenuLabels({ ...labels, save: 3 })).toThrow(InvalidArgument);
    expect(() => parseMenuLabels(null)).toThrow(InvalidArgument);
    const { save: _save, ...partial } = labels;
    expect(() => parseMenuLabels(partial)).toThrow(InvalidArgument);
    expect(parsePathArg(['/tmp/a.epd'])).toBe('/tmp/a.epd');
    expect(() => parsePathArg(['a.epd'])).toThrow(InvalidArgument);
    expect(() => parsePathArg([])).toThrow(InvalidArgument);
  });
});

describe('library arguments', () => {
  // protects=main never takes a malformed logo or library from the renderer; fails_when=a non-bytes logo, a missing library or a null library is accepted; no_claim=the library's content (the library service validates it)
  it('validates a logo and a replacement', () => {
    const logo = { mimeType: 'image/png', bytes: new Uint8Array(3) };
    expect(parseLibraryLogo(null)).toBeNull();
    expect(parseLibraryLogo(logo)).toEqual(logo);
    expect(() => parseLibraryLogo({ mimeType: 'image/png', bytes: [1] })).toThrow(InvalidArgument);
    expect(() => parseLibraryLogo({ bytes: new Uint8Array(1) })).toThrow(InvalidArgument);
    expect(parseLibraryReplacement([{ library: {}, logo }]).logo).toEqual(logo);
    expect(parseLibraryReplacement([{ library: {} }]).logo).toBeNull();
    expect(() => parseLibraryReplacement([{ library: null }])).toThrow(InvalidArgument);
    expect(() => parseLibraryReplacement([])).toThrow(InvalidArgument);
  });

  // protects=main only stores a known theme; fails_when=an unknown string, a non-string or nothing is accepted as a theme; no_claim=who may send it (the sender check)
  it('accepts only the three theme values', () => {
    for (const theme of ['system', 'light', 'dark'] as const)
      expect(parseThemePreference(theme)).toBe(theme);
    for (const value of ['Dark', 'auto', '', 1, null, undefined, { theme: 'dark' }])
      expect(() => parseThemePreference(value)).toThrow(InvalidArgument);
  });
});
