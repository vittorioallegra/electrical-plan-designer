import { expect, test } from '@playwright/test';

// The browser build answers from fixed sample prices (no network): this drives the real pages.
test.describe('Shelly prices', () => {
  // protects=Update prices in the running app; fails_when=the company country does not reach the price update, the dialog does not open from the Shelly catalog menu, or applied prices do not show in the catalog table; no_claim=shelly.com (the browser build has no network access to it)
  test('updates the Shelly catalog prices for the company country', async ({ page }) => {
    await page.goto('/settings/company');
    await page.getByRole('combobox', { name: 'Country' }).click();
    await page.getByRole('option', { name: 'Germany' }).click();

    await page.getByRole('link', { name: /Shelly catalog/ }).click();
    await page.getByRole('button', { name: 'Actions for Shelly catalog' }).click();
    await page.getByRole('menuitem', { name: /Update prices/ }).click();

    const dialog = page.getByRole('dialog', { name: 'Update Shelly prices' });
    await expect(dialog.getByText(/for Germany, without VAT \(19%\)/)).toBeVisible();
    await expect(dialog.getByRole('table')).toBeVisible();
    await dialog.getByRole('button', { name: 'Update prices' }).click();
    await expect(page.getByText('12 prices updated.').first()).toBeVisible();

    const row = page.getByRole('row', { name: /Shelly Pro 4PM/ });
    await expect(row).toContainText('99.08');
  });
});
