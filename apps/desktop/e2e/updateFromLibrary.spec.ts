import { expect, test } from '@playwright/test';
import { launchApp, openProjectFile, tempProject, type LaunchedApp } from './helpers';

// protects=AC 12 a library price reaches a project only through "Update from catalog", and undo takes it back; fails_when=the project quote changes when the library price does, the update does not change it, or Undo does not restore the old total; no_claim=the dialog's details (unit-tested)
test('a library price change reaches the project only after the update, and undo restores it', async () => {
  const project = tempProject();
  let launched: LaunchedApp | undefined;
  try {
    launched = await launchApp();
    const { page } = launched;
    await openProjectFile(launched, project.path);
    await page.getByRole('link', { name: 'Quote', exact: true }).click();
    const total = page.getByTestId('quote-total');
    await expect(total).toHaveText('€0.00');

    // Price a built-in box in the library, then come back to the project.
    await page.getByRole('link', { name: 'Settings' }).click();
    await page.getByRole('link', { name: 'Catalog', exact: true }).click();
    await page.getByRole('radio', { name: 'Wall boxes' }).click();
    await page.getByRole('cell', { name: 'Wall box 503 (3 modules)' }).click();
    await page.getByLabel('Price of Wall box 503 (3 modules)').fill('2');
    await page.getByLabel('Price of Wall box 503 (3 modules)').blur();
    await page.getByRole('link', { name: 'Back to Demo house' }).click();
    await page.getByRole('link', { name: 'Quote', exact: true }).click();
    await expect(total).toHaveText('€0.00');

    await page.getByRole('button', { name: 'Update from catalog' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('Wall box 503 (3 modules)')).toBeVisible();
    await dialog.getByRole('button', { name: 'Update 1 entry' }).click();
    await expect(total).not.toHaveText('€0.00');

    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(total).toHaveText('€0.00');

    // Saved, so closing the app does not ask about unsaved changes.
    await page.keyboard.press('Control+s');
    await expect(page.getByTestId('save-status')).toHaveText('Saved');
  } finally {
    await launched?.close().catch(() => undefined);
    project.cleanup();
  }
});
