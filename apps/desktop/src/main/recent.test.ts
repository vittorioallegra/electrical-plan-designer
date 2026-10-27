import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createRecentService, MAX_RECENT } from './recent';

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'epd-recent-'));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const file = () => join(dir, 'recent.json');
const touch = (name: string) => {
  const path = join(dir, name);
  writeFileSync(path, 'x');
  return path;
};

describe('recent files', () => {
  // protects=AC 7 recent list order and limit; fails_when=a reused path is listed twice, the newest is not first, or more than 10 are kept; no_claim=the menu and the start screen
  it('lists the newest first without duplicates and keeps ten', async () => {
    const recent = createRecentService({ file: file() });
    const paths = Array.from({ length: 12 }, (_, i) => touch(`p${i}.epd`));
    for (const path of paths) await recent.add(path);
    await recent.add(paths[5]!);
    const list = await recent.list();
    expect(list).toHaveLength(MAX_RECENT);
    expect(list[0]!.path).toBe(paths[5]);
    expect(list.filter((f) => f.path === paths[5])).toHaveLength(1);
    expect(list.map((f) => f.name).slice(0, 3)).toEqual(['p5.epd', 'p11.epd', 'p10.epd']);
  });

  // protects=AC 7 recent survives a restart, missing files are flagged and removable; fails_when=the list is lost on restart, a deleted file is dropped silently or shown as present, or remove keeps it; no_claim=atomic write details (atomicWrite tests)
  it('persists, flags a missing file and removes it on request', async () => {
    const a = touch('a.epd');
    const b = touch('b.epd');
    const first = createRecentService({ file: file() });
    await first.add(a);
    await first.add(b);
    expect(readdirSync(dir).sort()).toEqual(['a.epd', 'b.epd', 'recent.json']);

    rmSync(a);
    const second = createRecentService({ file: file() });
    expect(await second.list()).toEqual([
      { path: b, name: 'b.epd', missing: false, modifiedAt: statSync(b).mtimeMs },
      { path: a, name: 'a.epd', missing: true },
    ]);
    expect(await second.has(a)).toBe(true);
    await second.remove(a);
    expect((await second.list()).map((f) => f.path)).toEqual([b]);
    expect(await second.has(a)).toBe(false);
    expect(JSON.parse(readFileSync(file(), 'utf8')).paths).toEqual([b]);
  });

  // protects=the start screen's modified date; fails_when=modifiedAt is not the file's mtime, or a missing file reports one; no_claim=how the renderer formats it
  it('reports the modification time of a present file and none for a missing one', async () => {
    const present = touch('present.epd');
    utimesSync(present, new Date('2026-10-20T10:00:00Z'), new Date('2026-10-20T10:00:00Z'));
    const recent = createRecentService({ file: file() });
    await recent.add(present);
    await recent.add(join(dir, 'gone.epd'));
    const [gone, here] = await recent.list();
    expect(here!.modifiedAt).toBe(Date.parse('2026-10-20T10:00:00Z'));
    expect(gone!.missing).toBe(true);
    expect('modifiedAt' in gone!).toBe(false);
  });

  // protects=a damaged recent.json never blocks the app; fails_when=a corrupt or odd file throws or yields non-string entries; no_claim=recovering the lost entries
  it('starts empty from a corrupt file and ignores foreign entries', async () => {
    writeFileSync(file(), '{not json');
    expect(await createRecentService({ file: file() }).list()).toEqual([]);
    writeFileSync(file(), JSON.stringify({ paths: [1, null, join(dir, 'gone.epd')] }));
    const list = await createRecentService({ file: file() }).list();
    expect(list.map((f) => f.name)).toEqual(['gone.epd']);
  });

  // protects=menu refresh on change; fails_when=listeners are not told after add/remove, or are told when nothing changed; no_claim=what the listener does
  it('notifies listeners only when the list changed', async () => {
    const recent = createRecentService({ file: file() });
    let calls = 0;
    recent.onChange(() => void calls++);
    const a = touch('a.epd');
    await recent.add(a);
    await recent.add(a);
    expect(calls).toBe(1);
    await recent.remove(a);
    expect(calls).toBe(2);
  });
});
