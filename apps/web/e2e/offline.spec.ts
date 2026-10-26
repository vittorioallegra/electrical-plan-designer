import { expect, test } from '@playwright/test';
import { fixture, newProject, start } from './helpers';

// protects=offline use (PWA); fails_when=after the first visit the app, the lazy editor chunks or the pdf.js worker and wasm decoders need the network; no_claim=updates to a newer version, other browsers
test('works offline after the first visit, PDF import included', async ({ page, context }) => {
  await start(page);
  await page.evaluate(() => navigator.serviceWorker.ready);
  // The first visit installs the service worker; it controls the page from the next load.
  await page.reload();
  expect(await page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);

  await context.setOffline(true);
  const failed: string[] = [];
  page.on('requestfailed', (r) => failed.push(r.url()));
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Start' })).toBeVisible();

  await newProject(page, 'Offline house');
  await page.getByTestId('empty-canvas').getByRole('button', { name: 'Import plan' }).click();
  await page.getByTestId('background-file').setInputFiles(fixture('plan-ccitt.pdf'));
  await expect(page.getByTestId('background-panel')).toBeVisible();
  await page.getByRole('link', { name: 'Quote' }).click();
  await expect(page.getByRole('heading', { name: 'Quote', level: 1 })).toBeVisible();
  expect(failed).toEqual([]);
});
