import { expect, test, type Page } from '@playwright/test';
import { logIn } from './helpers';

const DEMO = '00000000-0000-4000-8000-0000000000aa';
const BOX = 'builtin:box_503';
const boxRow = (page: Page) => page.getByTestId('checklist').locator(`[data-key="${BOX}"]`);

async function openMobileDemo(page: Page) {
  await page.goto(`/m/projects/${DEMO}`);
  await expect(page.getByTestId('checklist')).toBeVisible();
}

// protects=AC 14 phone ↔ desktop purchase sync; fails_when=a tick is not visible on the other device after reload; no_claim=offline behavior, BOM changes (desktop edits stay in its draft)
test('tick on the phone, see it on desktop, and untick it there', async ({ browser }) => {
  const context = await browser.newContext();
  const phone = await context.newPage();
  await phone.setViewportSize({ width: 375, height: 812 });
  await logIn(phone);
  await expect(phone).toHaveURL(/\/m\/projects$/);

  await openMobileDemo(phone);
  // The demo project is shared between runs: start from "not bought".
  const checkbox = boxRow(phone).getByRole('checkbox');
  if (await checkbox.isChecked()) await checkbox.uncheck();
  await expect(boxRow(phone)).toHaveAttribute('data-status', 'not_bought');
  await checkbox.check();
  await expect(boxRow(phone)).toHaveAttribute('data-status', 'done');

  // A new tab has its own session view mode: wide → desktop editor.
  const desktop = await context.newPage();
  await desktop.setViewportSize({ width: 1400, height: 900 });
  await desktop.goto(`/projects/${DEMO}/plan`);
  await desktop.getByRole('tab', { name: 'BOM' }).click();
  const desktopBox = desktop.getByLabel('Bought: Wall box 503 (3 modules)');
  await expect(desktopBox).toBeChecked();

  // Untick on desktop: the phone shows it after reload.
  await desktopBox.uncheck();
  await expect(desktopBox).not.toBeChecked();
  await phone.reload();
  await expect(boxRow(phone)).toHaveAttribute('data-status', 'not_bought');
  await context.close();
});

// protects=read-only plan on the phone; fails_when=the plan tab does not render or floors cannot be switched; no_claim=touch gestures
test('browse the read-only plan by floor on the phone', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await logIn(page);
  await openMobileDemo(page);
  await page.getByRole('tab', { name: 'Plan' }).click();
  await expect(page.getByTestId('mobile-plan').locator('canvas').first()).toBeVisible();
  await page.getByRole('button', { name: 'First floor' }).click();
  await expect(page.getByRole('button', { name: 'First floor' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: 'Zoom in' }).click();
});
