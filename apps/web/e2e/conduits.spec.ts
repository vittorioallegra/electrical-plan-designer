import { expect, test } from '@playwright/test';
import { clickWorld, editorState, logIn, newProject } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await logIn(page);
});

// protects=drawing nodes and conduits (AC 4 lengths through the UI); fails_when=placed boxes or the conduit length differ from the spec rule; no_claim=routing
test('place a panel and a socket box, draw a conduit, see its length with drops', async ({
  page,
}) => {
  await newProject(page, `Conduit ${Date.now()}`);
  await page.getByTestId('tool-panel').click();
  await clickWorld(page, { x: 1, y: 1 });
  await page.getByTestId('tool-terminal_box').click();
  await clickWorld(page, { x: 6, y: 1 });
  await page.getByTestId('tool-conduit').click();
  await clickWorld(page, { x: 1, y: 1 });
  await clickWorld(page, { x: 6, y: 1 });
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');

  const doc = await editorState(page, (s) => s.data.doc);
  expect(doc.panels).toHaveLength(1);
  expect(doc.segments).toHaveLength(1);

  // Panel 1.50 m + 5.00 m plan + socket 0.30 m.
  await clickWorld(page, { x: 3.5, y: 1 });
  await expect(page.getByTestId('segment-length')).toHaveText('6.80 m');
  await page.getByLabel('Run elevation').selectOption('ceiling');
  // 5.00 + (2.70 − 1.50) + (2.70 − 0.30)
  await expect(page.getByTestId('segment-length')).toHaveText('8.60 m');
  await expect(page.getByTestId('save-status')).toHaveText('Draft', { timeout: 5000 });
});
