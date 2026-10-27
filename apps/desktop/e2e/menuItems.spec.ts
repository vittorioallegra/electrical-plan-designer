import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import {
  clickMenu,
  focusWindow,
  launchApp,
  menuEnabled,
  menuLabels,
  openProjectFile,
  stubSaveDialog,
  tempProject,
  type LaunchedApp,
} from './helpers';

/** A file's text, empty until it exists (a poll stops at the first error). */
function fileText(path: string): string {
  try {
    return readFileSync(path, 'latin1');
  } catch {
    return '';
  }
}

// protects=Settings, Export and Import JSON in the native menu; fails_when=Settings is missing from the platform's menu or does not open General with the project still open, Export and Import JSON stay enabled in a window without a project (or disabled in one with it) as focus moves between windows, Export PDF or JSON writes nothing, or Import JSON does not open its file picker; no_claim=accelerators and the macOS no-window case (menu unit test)
test('the native menu has Settings, Export and Import JSON that follow the focused window', async () => {
  const project = tempProject();
  const scratch = mkdtempSync(join(tmpdir(), 'epd-menu-'));
  let launched: LaunchedApp | undefined;
  try {
    launched = await launchApp();
    const { app, page } = launched;
    const mac = (await app.evaluate(() => process.platform)) === 'darwin';
    await expect(page.getByRole('heading', { name: 'Start' })).toBeVisible();

    // Without a project: Settings is there, the project items are disabled.
    await expect
      .poll(() => menuLabels(app, 'File'))
      .toEqual(expect.arrayContaining(['Export', 'Import JSON…']));
    expect(await menuLabels(app, 'File', 'Export')).toEqual(['PDF…', 'JSON…']);
    expect(await menuEnabled(app, 'File', 'Export')).toBe(false);
    expect(await menuEnabled(app, 'File', 'Import JSON…')).toBe(false);
    const settingsPath = mac ? ['Electrical Plan Designer', 'Settings…'] : ['File', 'Settings…'];
    expect(await menuEnabled(app, ...settingsPath)).toBe(true);

    await openProjectFile(launched, project.path);
    await focusWindow(app, true);
    await expect.poll(() => menuEnabled(app, 'File', 'Export')).toBe(true);
    expect(await menuEnabled(app, 'File', 'Import JSON…')).toBe(true);

    // A second window without a project: the items follow the focused window.
    const secondOpened = app.waitForEvent('window');
    await app.evaluate(() => (globalThis as { epdOpenWindow?: () => void }).epdOpenWindow!());
    const second = await secondOpened;
    await expect(second.getByRole('heading', { name: 'Start' })).toBeVisible();
    // The window with the project has its name in the title.
    const focus = (withProject: boolean) => focusWindow(app, withProject);
    await focus(false);
    await expect.poll(() => menuEnabled(app, 'File', 'Export')).toBe(false);
    expect(await menuEnabled(app, 'File', 'Import JSON…')).toBe(false);
    await focus(true);
    await expect.poll(() => menuEnabled(app, 'File', 'Export')).toBe(true);
    await second.close();
    await focus(true);

    // Export from the menu writes the files.
    const json = join(scratch, 'out.json');
    await stubSaveDialog(app, json);
    await clickMenu(app, 'File', 'Export', 'JSON…');
    await expect.poll(() => fileText(json).length).toBeGreaterThan(100);
    expect(JSON.parse(readFileSync(json, 'utf8'))).toHaveProperty('floors');
    const pdf = join(scratch, 'out.pdf');
    await stubSaveDialog(app, pdf);
    await clickMenu(app, 'File', 'Export', 'PDF…');
    await expect.poll(() => fileText(pdf).slice(0, 4)).toBe('%PDF');

    // Settings opens General, the project stays open (back to it from the top bar).
    await clickMenu(app, ...settingsPath);
    await expect(page).toHaveURL(/\/settings\/general$/);

    // Import JSON asks for the file by clicking the page's file input. The native file dialog
    // cannot be driven, so the click is recorded instead and the file is fed to the input.
    await page.goBack();
    await expect(page.getByTestId('project-name')).toHaveText('Demo house');
    const input = page.getByTestId('import-json');
    await input.evaluate((el) => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        (window as unknown as { importAsked: boolean }).importAsked = true;
      });
    });
    await clickMenu(app, 'File', 'Import JSON…');
    await expect
      .poll(() => page.evaluate(() => (window as unknown as { importAsked?: boolean }).importAsked))
      .toBe(true);
    await input.setInputFiles(json);
    await expect(
      page.getByText('Project imported. Undo restores the previous version.'),
    ).toBeVisible();

    // Saved, so quitting at the end of the test does not ask about the import.
    await page.keyboard.press('Control+s');
    await expect(page.getByTestId('save-status')).toHaveText('Saved');
  } finally {
    await launched?.close().catch(() => undefined);
    project.cleanup();
    rmSync(scratch, { recursive: true, force: true });
  }
});
