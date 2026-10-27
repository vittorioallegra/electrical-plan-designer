import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import * as nodeFs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createFileService, type FileDialogs, type FsOps } from './files';

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'epd-files-'));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const bytes = (...values: number[]) => new Uint8Array(values);
const read = (path: string) => [...readFileSync(path)];

function dialogsReturning(open: string | null, save: string | null): FileDialogs<null> {
  return {
    chooseFileToOpen: async () => open,
    chooseFileToSave: async () => save,
  };
}

function service(open: string | null, save: string | null = null, fs?: FsOps) {
  return createFileService<null>({ dialogs: dialogsReturning(open, save), ...(fs ? { fs } : {}) });
}

describe('file service', () => {
  // protects=AC 2 save in place; fails_when=Save writes another file, leaves a temp file behind, or the returned stat is not the file's new stat; no_claim=the dialogs and the renderer flow
  it('opens a file and saves over the same path, leaving no other file in the folder', async () => {
    const path = join(dir, 'house.epd');
    writeFileSync(path, bytes(1, 2, 3));
    const files = service(path);
    const opened = (await files.open(null))!;
    expect(opened).toMatchObject({ path, name: 'house.epd', stat: { size: 3 } });
    expect([...opened.bytes]).toEqual([1, 2, 3]);

    const saved = await files.save(path, bytes(9, 9, 9, 9), opened.stat);
    expect(saved).toMatchObject({ status: 'saved', path, name: 'house.epd', stat: { size: 4 } });
    expect(read(path)).toEqual([9, 9, 9, 9]);
    expect(readdirSync(dir)).toEqual(['house.epd']);

    // The stat it returned is the one the next save expects.
    const again = await files.save(path, bytes(5), (saved as { stat: typeof opened.stat }).stat);
    expect(again.status).toBe('saved');
  });

  // protects=AC 3 interrupted save; fails_when=a failure between the temp write and the rename changes the original or leaves the temp file; no_claim=power loss (the OS rename is atomic)
  it('keeps the original and removes the temp file when the rename fails', async () => {
    const path = join(dir, 'house.epd');
    writeFileSync(path, bytes(1, 2, 3));
    const fs: FsOps = {
      ...nodeFs,
      rename: async () => {
        throw Object.assign(new Error('busy'), { code: 'EBUSY' });
      },
    };
    const files = service(path, null, fs);
    const opened = (await files.open(null))!;
    expect(await files.save(path, bytes(7, 7), opened.stat)).toEqual({
      status: 'failed',
      code: 'EBUSY',
    });
    expect(read(path)).toEqual([1, 2, 3]);
    expect(readdirSync(dir)).toEqual(['house.epd']);
  });

  // protects=AC 4 changed on disk; fails_when=Save overwrites a file another program changed, or refuses one that did not change, or a null expected stat does not overwrite; no_claim=content comparison (only modified time and size)
  it('refuses a save when the file changed on disk, until the stat is dropped', async () => {
    const path = join(dir, 'house.epd');
    writeFileSync(path, bytes(1, 2, 3));
    const files = service(path);
    const opened = (await files.open(null))!;

    writeFileSync(path, bytes(1, 2, 3));
    const later = new Date(Date.now() + 60_000);
    utimesSync(path, later, later);
    expect(await files.save(path, bytes(8), opened.stat)).toEqual({ status: 'changed_on_disk' });
    expect(read(path)).toEqual([1, 2, 3]);

    expect((await files.save(path, bytes(8), null)).status).toBe('saved');
    expect(read(path)).toEqual([8]);
  });

  // protects=AC 5 write errors; fails_when=a write to a missing folder throws instead of returning the OS code, or the project file is touched; no_claim=read-only volumes (same code path)
  it('reports the OS error code of a write that fails', async () => {
    const path = join(dir, 'gone', 'house.epd');
    mkdirSync(join(dir, 'gone'));
    writeFileSync(path, bytes(1));
    const files = service(path);
    const opened = (await files.open(null))!;
    rmSync(join(dir, 'gone'), { recursive: true });
    expect(await files.save(path, bytes(2), opened.stat)).toEqual({
      status: 'failed',
      code: 'ENOENT',
    });
  });

  // protects=path allowlist; fails_when=main writes a path it never handed out (a compromised renderer); no_claim=path traversal in dialog results (the dialog is the user)
  it('writes only to paths handed out by a dialog or allowed explicitly', async () => {
    const other = join(dir, 'other.epd');
    const files = service(null);
    expect(await files.save(other, bytes(1), null)).toEqual({ status: 'failed', code: 'EPERM' });
    expect(readdirSync(dir)).toEqual([]);
    files.allow(other);
    expect((await files.save(other, bytes(1), null)).status).toBe('saved');
  });

  // protects=Save As and export; fails_when=Save As does not add .epd, does not hand out the path, cancel writes something, or an export becomes a path Save may overwrite; no_claim=the native dialog UI
  it('saves as and exports through the dialog path', async () => {
    const target = join(dir, 'new');
    const files = service(null, target);
    const saved = await files.saveAs(null, 'x.epd', bytes(4));
    expect(saved).toMatchObject({ status: 'saved', path: `${target}.epd`, name: 'new.epd' });
    expect(files.isAllowed(`${target}.epd`)).toBe(true);

    const pdf = join(dir, 'a.pdf');
    const exporter = service(null, pdf);
    expect(await exporter.exportFile(null, 'a.pdf', bytes(5), [])).toEqual({
      status: 'saved',
      path: pdf,
    });
    expect(exporter.isAllowed(pdf)).toBe(false);

    expect(await service(null, null).saveAs(null, 'x.epd', bytes(1))).toEqual({
      status: 'cancelled',
    });
    expect(readdirSync(dir).sort()).toEqual(['a.pdf', 'new.epd']);
  });

  // protects=the import dialog of the native menu's Import JSON; fails_when=the picked file's name or bytes are not returned, the import filters do not reach the dialog, a cancel is not null, or the picked file becomes writable by save; no_claim=the renderer import
  it('reads a file picked to import without letting save write it', async () => {
    const path = join(dir, 'doc.json');
    writeFileSync(path, bytes(7, 8));
    const filters = [{ name: 'JSON', extensions: ['json'] }];
    let asked: unknown;
    const files = createFileService<null>({
      dialogs: {
        chooseFileToOpen: async (_owner, f) => {
          asked = f;
          return path;
        },
        chooseFileToSave: async () => null,
      },
    });
    const picked = (await files.openImport(null, filters))!;
    expect(picked.name).toBe('doc.json');
    expect([...picked.bytes]).toEqual([7, 8]);
    expect(asked).toEqual(filters);
    expect(files.isAllowed(path)).toBe(false);
    expect(await service(null).openImport(null, filters)).toBeNull();
  });

  // protects=serialized writes per path; fails_when=two saves of one path overlap so the later request does not end up on disk; no_claim=writes to different paths (independent)
  it('applies concurrent saves of one path in the order they were requested', async () => {
    const path = join(dir, 'house.epd');
    writeFileSync(path, bytes(0));
    const files = service(path);
    await files.open(null);
    const results = await Promise.all(
      [1, 2, 3, 4, 5].map((n) => files.save(path, new Uint8Array(n * 1000).fill(n), null)),
    );
    expect(results.every((r) => r.status === 'saved')).toBe(true);
    expect(readFileSync(path).length).toBe(5000);
    expect(readdirSync(dir)).toEqual(['house.epd']);
  });
});

describe('opening a known path', () => {
  // protects=AC 7 recent and OS open; fails_when=a path nobody handed out can be read or written, a recent path cannot be opened and then saved, or a deleted file throws instead of reporting it missing; no_claim=which paths are in the recent list (recent tests)
  it('opens only paths from the recent list or the OS and allows them for Save', async () => {
    const path = join(dir, 'house.epd');
    const other = join(dir, 'other.epd');
    writeFileSync(path, bytes(1, 2));
    writeFileSync(other, bytes(3));
    const used: string[] = [];
    const files = createFileService<null>({
      dialogs: dialogsReturning(null, null),
      canOpen: async (p) => p === path,
      onUsed: (p) => used.push(p),
    });
    await expect(files.openPath(other)).rejects.toThrow('path not allowed');
    expect((await files.save(path, bytes(1), null)).status).toBe('failed');

    const opened = (await files.openPath(path))!;
    expect([...opened.bytes]).toEqual([1, 2]);
    expect((await files.save(path, bytes(7), opened.stat)).status).toBe('saved');
    expect(used).toEqual([path, path]);

    files.allow(other);
    rmSync(other);
    expect(await files.openPath(other)).toBeNull();
  });
});
