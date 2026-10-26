import { expect, test } from '@playwright/test';
import { clickWorld, fixture, newProject, savedBytes, start } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await start(page);
});

// protects=AC 15 project PDF with a private background (blob URL, no tainted canvas); fails_when=the export fails or saves no PDF; no_claim=PDF content (projectPdf tests)
test('export the project PDF of a floor with a private background', async ({ page }) => {
  const name = `PDF ${Date.now()}`;
  const pdfName = `${name.replace(/ /g, '-')}.pdf`;
  await newProject(page, name);
  await page.getByTestId('empty-canvas').getByRole('button', { name: 'Import plan' }).click();
  await page.getByTestId('background-file').setInputFiles(fixture('plan-1000x800.png'));
  await expect(page.getByTestId('background-panel')).toContainText('Not calibrated');
  await page.getByTestId('tool-panel').click();
  await clickWorld(page, { x: 1, y: 1 });
  await expect(page.getByTestId('save-status')).toHaveText('Draft', { timeout: 5000 });

  await page.getByRole('button', { name: 'Export' }).click();
  await page.getByRole('menuitem', { name: 'Project PDF' }).click();
  await expect.poll(() => savedBytes(page, pdfName)).not.toBeNull();
  const bytes = Buffer.from((await savedBytes(page, pdfName))!);
  expect(bytes.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  expect(bytes.toString('latin1')).toContain('/Subtype /Image');
});

// protects=AC 15 quote exports from the quote page; fails_when=issuing or the CSV/PDF exports fail; no_claim=quote math
test('issue a quote and download its CSV and PDF', async ({ page }) => {
  const name = `Quote ${Date.now()}`;
  const base = `${name.replace(/ /g, '-')}-quote-1`;
  await newProject(page, name);
  await page.getByRole('link', { name: 'Quote' }).click();
  await page.getByRole('button', { name: 'Lump sum' }).click();
  await page.getByLabel('Amount').fill('100');
  await page.getByLabel('Amount').press('Enter');
  await expect(page.getByTestId('quote-total')).toHaveText('€122.00');
  await page.getByRole('button', { name: 'Issue quote' }).click();
  const issued = page.getByRole('region', { name: 'Issued quotes' });
  await expect(issued.getByText('No. 1')).toBeVisible();

  await issued.getByRole('button', { name: /^CSV / }).click();
  await expect.poll(() => savedBytes(page, `${base}.csv`)).not.toBeNull();
  const csv = Buffer.from((await savedBytes(page, `${base}.csv`))!).toString('utf8');
  expect(csv).toContain(';Installation;;;;100.00;Labor');

  await issued.getByRole('button', { name: /^PDF / }).click();
  await expect.poll(() => savedBytes(page, `${base}.pdf`)).not.toBeNull();
  const pdf = Buffer.from((await savedBytes(page, `${base}.pdf`))!);
  expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
});
