import {
  chmodSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import {
  floorCount,
  launchApp,
  openProjectFile,
  stubSaveDialog,
  tempProject,
  windowTitle,
  type LaunchedApp,
} from './helpers';

async function withApp(run: (launched: LaunchedApp) => Promise<void>) {
  let launched: LaunchedApp | undefined;
  try {
    launched = await launchApp();
    await run(launched);
  } finally {
    await launched?.close().catch(() => undefined);
  }
}

// protects=AC 2 save in place and the window title; fails_when=Save writes a different or a second file, leaves a temp file, the saved project lacks the edit, or the title/edited dot does not follow the unsaved state; no_claim=Windows title rendering (unit-tested), crash safety (unit-tested)
test('open, edit and save write the same path and nothing else', async () => {
  const project = tempProject();
  try {
    await withApp(async (launched) => {
      const { app, page } = launched;
      await openProjectFile(launched, project.path);
      const before = floorCount(project.path);
      expect(await windowTitle(app)).toBe('Demo house - Electrical Plan Designer');

      await page.getByRole('button', { name: 'Add floor' }).click();
      if (process.platform === 'darwin') {
        expect(
          await app.evaluate(({ BrowserWindow }) =>
            BrowserWindow.getAllWindows()[0]!.isDocumentEdited(),
          ),
        ).toBe(true);
      } else {
        await expect.poll(() => windowTitle(app)).toBe('*Demo house - Electrical Plan Designer');
      }

      await page.keyboard.press('Control+s');
      await expect(page.getByTestId('save-status')).toHaveText('Saved');
      expect(floorCount(project.path)).toBe(before + 1);
      expect(readdirSync(project.dir)).toEqual(['house.epd']);
      await expect.poll(() => windowTitle(app)).toBe('Demo house - Electrical Plan Designer');
    });
  } finally {
    project.cleanup();
  }
});

// protects=AC 4 changed on disk; fails_when=Save overwrites a file another program changed without asking, Cancel writes anyway, or Overwrite does not write; no_claim=the stat comparison details (unit-tested)
test('asks before overwriting a file changed by another program', async () => {
  const project = tempProject();
  try {
    await withApp(async (launched) => {
      const { page } = launched;
      await openProjectFile(launched, project.path);
      await page.getByRole('button', { name: 'Add floor' }).click();

      // Another program rewrites the file (same size is not enough: the time changed).
      const other = readFileSync(project.path);
      writeFileSync(project.path, other);
      const later = new Date(Date.now() + 60_000);
      utimesSync(project.path, later, later);
      const before = floorCount(project.path);

      await page.keyboard.press('Control+s');
      const dialog = page.getByRole('dialog', { name: 'The file changed on disk' });
      await expect(dialog).toBeVisible();
      await dialog.getByRole('button', { name: 'Cancel' }).click();
      expect(floorCount(project.path)).toBe(before);
      await expect(page.getByTestId('save-status')).not.toHaveText('Saved');

      await page.keyboard.press('Control+s');
      await page.getByRole('button', { name: 'Overwrite' }).click();
      await expect(page.getByTestId('save-status')).toHaveText('Saved');
      expect(floorCount(project.path)).toBe(before + 1);
    });
  } finally {
    project.cleanup();
  }
});

// protects=AC 5 write errors; fails_when=a save into a read-only folder is reported saved, shows no OS error, or Save As does not write the project elsewhere; no_claim=Windows (the folder permission model differs)
test('shows the OS error for a read-only folder and saves elsewhere with Save As', async () => {
  test.skip(process.platform === 'win32', 'folder permissions differ on Windows');
  const project = tempProject();
  const elsewhere = mkdtempSync(join(tmpdir(), 'epd-elsewhere-'));
  try {
    await withApp(async (launched) => {
      const { app, page } = launched;
      await openProjectFile(launched, project.path);
      await page.getByRole('button', { name: 'Add floor' }).click();
      const before = floorCount(project.path);

      chmodSync(project.dir, 0o555);
      await page.keyboard.press('Control+s');
      const dialog = page.getByRole('dialog', { name: 'Could not save the file' });
      await expect(dialog).toContainText('EACCES');
      expect(floorCount(project.path)).toBe(before);
      expect(readdirSync(project.dir)).toEqual(['house.epd']);

      const target = join(elsewhere, 'copy.epd');
      await stubSaveDialog(app, target);
      await dialog.getByRole('button', { name: 'Save as…' }).click();
      await expect(page.getByTestId('save-status')).toHaveText('Saved');
      expect(floorCount(target)).toBe(before + 1);
    });
  } finally {
    project.cleanup();
    rmSync(elsewhere, { recursive: true, force: true });
  }
});

// protects=AC 8 quit prompt; fails_when=quitting with unsaved changes exits without asking, Cancel exits, or Don't save keeps the app running; no_claim=Save from the prompt (web tests), a hung renderer (unit-tested)
test('quitting with unsaved changes asks, and Cancel keeps the app open', async () => {
  const project = tempProject();
  try {
    await withApp(async (launched) => {
      const { app, page } = launched;
      await openProjectFile(launched, project.path);
      await page.getByRole('button', { name: 'Add floor' }).click();
      await expect.poll(() => windowTitle(app)).toMatch(/^\*?Demo house/);

      await app.evaluate(({ app: electron }) => electron.quit());
      const dialog = page.getByRole('dialog', { name: 'Save changes to “Demo house”?' });
      await expect(dialog).toBeVisible();
      await dialog.getByRole('button', { name: 'Cancel' }).click();
      await expect(dialog).toBeHidden();
      expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)).toBe(
        1,
      );

      const exited = new Promise<void>((resolve) => app.process().once('exit', () => resolve()));
      // The app exits, so the evaluate never gets its answer.
      void app.evaluate(({ app: electron }) => electron.quit()).catch(() => undefined);
      await dialog.getByRole('button', { name: 'Don’t save' }).click();
      await exited;
    });
  } finally {
    project.cleanup();
  }
});
