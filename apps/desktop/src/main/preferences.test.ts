import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createPreferencesService } from './preferences';

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'epd-prefs-'));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const file = () => join(dir, 'preferences.json');

describe('preferences', () => {
  // protects=a first run, a broken file and a bad value all start on the default theme; fails_when=a missing file, invalid JSON, a non-object or an unknown theme throws or is applied; no_claim=nativeTheme
  it('defaults to system when the file is missing, unreadable or invalid', async () => {
    const missing = createPreferencesService({ file: file() });
    await missing.load();
    expect(missing.theme()).toBe('system');

    for (const content of ['not json', 'null', '[]', '{"theme":"purple"}', '{"theme":3}']) {
      writeFileSync(file(), content);
      const service = createPreferencesService({ file: file() });
      await service.load();
      expect(service.theme()).toBe('system');
    }
  });

  // protects=the theme survives a restart; fails_when=setTheme does not write preferences.json, leaves a temp file, or a new service reads back another value; no_claim=concurrent windows
  it('writes the theme atomically and reads it back', async () => {
    const service = createPreferencesService({ file: file() });
    await service.setTheme('dark');
    expect(service.theme()).toBe('dark');
    expect(JSON.parse(readFileSync(file(), 'utf8'))).toMatchObject({ theme: 'dark' });
    expect(readdirSync(dir)).toEqual(['preferences.json']);

    const next = createPreferencesService({ file: file() });
    await next.load();
    expect(next.theme()).toBe('dark');
  });

  // protects=listeners (nativeTheme, window broadcast) hear every change and a failing disk does not lose it for this run; fails_when=a listener is not called, or an unwritable folder rejects or drops the value; no_claim=the error log text
  it('tells listeners and keeps the value when the write fails', async () => {
    const service = createPreferencesService({ file: join(dir, 'missing-folder', 'p.json') });
    const heard: string[] = [];
    service.onThemeChange((theme) => heard.push(theme));
    await service.setTheme('light');
    await service.setTheme('system');
    expect(heard).toEqual(['light', 'system']);
    expect(service.theme()).toBe('system');
  });
});
