import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { floorCount, launchApp, openProjectFile, tempProject, type LaunchedApp } from './helpers';

// protects=AC 9 crash recovery; fails_when=a killed app does not offer the edit on the next start, restoring loses the edit or its unsaved state, Save writes anywhere but the original path, or a saved project is offered again; no_claim=a power cut (the atomic write is unit-tested), Windows process kill semantics
test('after a kill the edit is offered back and saving writes the original path', async () => {
  const project = tempProject();
  const userData = mkdtempSync(join(tmpdir(), 'epd-recovery-'));
  const launched: LaunchedApp[] = [];
  try {
    const first = await launchApp(userData);
    launched.push(first);
    await openProjectFile(first, project.path);
    const before = floorCount(project.path);
    await first.page.getByRole('button', { name: 'Add floor' }).click();
    // Autosave writes the copy about a second after the edit.
    const copy = join(userData, 'recovery', 'project.json');
    await expect.poll(() => existsSync(copy), { timeout: 10_000 }).toBe(true);
    await expect
      .poll(
        () =>
          (JSON.parse(readFileSync(copy, 'utf8')) as { doc: { floors: unknown[] } }).doc.floors
            .length,
      )
      .toBe(before + 1);
    // Only the process this test launched.
    const exited = new Promise<void>((resolve) =>
      first.app.process().once('exit', () => resolve()),
    );
    first.app.process().kill('SIGKILL');
    await exited;
    expect(floorCount(project.path)).toBe(before);

    const second = await launchApp(userData);
    launched.push(second);
    const { page } = second;
    const card = page.getByRole('region', { name: 'Recovered project' });
    await expect(card).toContainText('Demo house');
    await expect(card).toContainText('File: house.epd');
    await card.getByRole('button', { name: 'Restore' }).click();
    await expect(page.getByTestId('project-name')).toHaveText('Demo house');
    await expect(page.getByTestId('save-status')).toHaveText('Draft');

    await page.keyboard.press('Control+s');
    await expect(page.getByTestId('save-status')).toHaveText('Saved');
    expect(floorCount(project.path)).toBe(before + 1);
    // Saved: the copy is gone, so the next start does not offer it.
    await expect.poll(() => existsSync(join(userData, 'recovery'))).toBe(false);
  } finally {
    for (const app of launched) await app.close().catch(() => undefined);
    rmSync(userData, { recursive: true, force: true });
    project.cleanup();
  }
});
