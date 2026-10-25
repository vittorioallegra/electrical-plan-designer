import { expect, test, type Page } from '@playwright/test';
import type { EditorStore } from '../src/state/editorStore';
import { logIn } from './helpers';

const DEMO = '00000000-0000-4000-8000-0000000000aa';
const BOX = 'builtin:box_503';
const boxRow = (page: Page) => page.getByTestId('checklist').locator(`[data-key="${BOX}"]`);

async function openMobileDemo(page: Page) {
  await page.goto(`/m/projects/${DEMO}`);
  await expect(page.getByTestId('checklist')).toBeVisible();
}

// protects=AC 14 phone ↔ desktop purchase sync and the shortfall after the BOM grows; fails_when=a tick is not visible on the other device after reload or a grown line still looks done; no_claim=offline behavior
test('tick on the phone, see it on desktop, and see a shortfall when the BOM grows', async ({
  browser,
}) => {
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

  // The BOM grows by one box: the phone shows the shortfall after reload.
  await desktop.evaluate(() => {
    const store = (window as unknown as { __epd: { store: EditorStore } }).__epd.store;
    store.getState().applyCommand('extra box', (d) => {
      const src = d.doc.nodes.find((n) => n.id === 'n_s1')!;
      d.doc.nodes.push({ ...JSON.parse(JSON.stringify(src)), id: 'n_e2e_box', label: 'E2E box' });
    });
  });
  await expect(desktop.getByTestId('save-status')).toHaveText('Saved', { timeout: 5000 });
  await phone.reload();
  await expect(boxRow(phone)).toHaveAttribute('data-status', 'partial');
  await expect(boxRow(phone)).toContainText('Bought 4 pcs / need 5 pcs');

  // Vice versa: untick on desktop, the phone shows it after reload. Then restore the demo.
  await desktop.getByRole('button', { name: 'Undo' }).click();
  await expect(desktop.getByTestId('save-status')).toHaveText('Saved', { timeout: 5000 });
  await desktopBox.check();
  await expect(desktopBox).toBeChecked();
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
