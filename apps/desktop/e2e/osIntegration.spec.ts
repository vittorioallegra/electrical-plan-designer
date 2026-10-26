import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import {
  clickMenu,
  launchApp,
  launchSecondInstance,
  menuLabels,
  stubOpenDialog,
  tempProject,
  type LaunchedApp,
} from './helpers';

async function withApp(run: (launched: LaunchedApp) => Promise<void>, extraArgs: string[] = []) {
  let launched: LaunchedApp | undefined;
  try {
    launched = await launchApp(undefined, extraArgs);
    await run(launched);
  } finally {
    await launched?.close().catch(() => undefined);
  }
}

const recentPaths = (userData: string): string[] =>
  (JSON.parse(readFileSync(join(userData, 'recent.json'), 'utf8')) as { paths: string[] }).paths;

// protects=AC 6 a .epd on the command line opens at launch; fails_when=a project file passed at launch is ignored, opens before the page is ready and is lost, or is not remembered in the recent list; no_claim=macOS open-file (same path, not drivable here)
test('a project file on the command line opens at launch', async () => {
  const project = tempProject();
  try {
    await withApp(
      async ({ page, userData }) => {
        await expect(page.getByTestId('project-name')).toHaveText('Demo house');
        await expect.poll(() => recentPaths(userData)).toEqual([project.path]);
      },
      [project.path],
    );
  } finally {
    project.cleanup();
  }
});

// protects=AC 6 single instance and open while running; fails_when=a second launch opens a second window, the file does not reach the first instance, or it replaces unsaved changes without the question; no_claim=Windows double-click (the same second-instance event)
test('a second launch routes its file to the running app through the unsaved question', async () => {
  const project = tempProject();
  try {
    await withApp(async (launched) => {
      const { app, page } = launched;
      await expect(page.getByRole('heading', { name: 'Start' })).toBeVisible();

      expect(await launchSecondInstance(launched, [project.path])).toBe(0);
      await expect(page.getByTestId('project-name')).toHaveText('Demo house');
      expect(app.windows()).toHaveLength(1);

      await page.getByRole('button', { name: 'Add floor' }).click();
      await expect(page.getByTestId('save-status')).not.toHaveText('Saved');
      await launchSecondInstance(launched, [project.path]);
      const dialog = page.getByRole('dialog', { name: 'Discard unsaved changes?' });
      await expect(dialog).toBeVisible();
      await dialog.getByRole('button', { name: 'Cancel' }).click();
      await expect(page.getByTestId('save-status')).not.toHaveText('Saved');

      // Saved, so quitting at the end of the test does not ask about the edit.
      await page.keyboard.press('Control+s');
      await expect(page.getByTestId('save-status')).toHaveText('Saved');
    });
  } finally {
    project.cleanup();
  }
});

// protects=AC 6 and 7 native menu, labels, Open Recent; fails_when=the menu lacks the File items in the app's language, Open... does not open a project, or the opened file is not listed in Open Recent and does not open from it; no_claim=accelerators and the platform's menu rendering (menu unit test)
test('the native menu opens files and lists them under Open Recent', async () => {
  const project = tempProject();
  try {
    await withApp(async ({ app, page }) => {
      await expect
        .poll(() => menuLabels(app, 'File'))
        .toEqual(
          expect.arrayContaining(['New project', 'Open…', 'Open Recent', 'Save', 'Save As…']),
        );
      expect(await menuLabels(app, 'File', 'Open Recent')).toEqual(['No recent files']);

      await stubOpenDialog(app, project.path);
      await clickMenu(app, 'File', 'Open…');
      await expect(page.getByTestId('project-name')).toHaveText('Demo house');
      await expect.poll(() => menuLabels(app, 'File', 'Open Recent')).toEqual(['house.epd']);

      await clickMenu(app, 'File', 'Close project');
      await expect(page.getByRole('heading', { name: 'Start' })).toBeVisible();
      await clickMenu(app, 'File', 'Open Recent', 'house.epd');
      await expect(page.getByTestId('project-name')).toHaveText('Demo house');
    });
  } finally {
    project.cleanup();
  }
});
