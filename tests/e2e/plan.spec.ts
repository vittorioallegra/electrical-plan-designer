import { expect, test } from '@playwright/test';
import { clickWorld, editorState, logIn, newProject } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await logIn(page);
});

// protects=AC 2 import + calibration; fails_when=a calibrated 4.20 m distance measures off by > 1 cm; no_claim=PDF import
test('import a PNG, calibrate two points 4.20 m apart, and measure 4.20 m between them', async ({
  page,
}) => {
  await newProject(page, `AC2 ${Date.now()}`);
  await page.getByTestId('empty-canvas').getByRole('button', { name: 'Import plan' }).click();
  await page.getByTestId('background-file').setInputFiles('tests/fixtures/plan-1000x800.png');
  await expect(page.getByTestId('background-panel')).toContainText('Not calibrated');

  // Uncalibrated: 1 px = 1 cm. Click image pixels (100, 100) and (310, 100).
  await page.getByTestId('tool-calibrate').click();
  await clickWorld(page, { x: 1, y: 1 });
  await clickWorld(page, { x: 3.1, y: 1 });
  await page.getByLabel('Real distance').fill('4.20');
  await page.getByRole('button', { name: 'Calibrate' }).last().click();
  await expect(page.getByTestId('background-panel')).toContainText(
    'Calibrated on a known distance of 4.20 m',
  );

  const bg = await editorState(page, (s) => s.data.doc.floors[0]!.background!);
  const cal = bg.calibration!;
  const mpp = cal.realDistance / Math.hypot(cal.p2.x - cal.p1.x, cal.p2.y - cal.p1.y);
  const p1 = { x: cal.p1.x * mpp, y: cal.p1.y * mpp };
  const p2 = { x: cal.p2.x * mpp, y: cal.p2.y * mpp };

  await page.getByTestId('tool-wall').click();
  await clickWorld(page, p1, true);
  await clickWorld(page, p2, true);
  await page.keyboard.press('Escape');
  const walls = await editorState(page, (s) => s.data.doc.floors[0]!.walls);
  expect(walls).toHaveLength(1);
  const length = Math.hypot(walls[0]!.b.x - walls[0]!.a.x, walls[0]!.b.y - walls[0]!.a.y);
  expect(Math.abs(length - 4.2)).toBeLessThan(0.01);
  await expect(page.getByTestId('save-status')).toHaveText('Saved', { timeout: 5000 });
});

// protects=AC 3 walls-only plans; fails_when=walls drawn without a background are not in meters; no_claim=segments (step 14)
test('draw a plan with walls only, in meters', async ({ page }) => {
  await newProject(page, `AC3 ${Date.now()}`);
  await page.getByTestId('empty-canvas').getByRole('button', { name: 'Draw walls' }).click();
  for (const p of [
    { x: 0, y: 0 },
    { x: 5, y: 0 },
    { x: 5, y: 4 },
    { x: 0, y: 4 },
    { x: 0, y: 0 },
  ]) {
    await clickWorld(page, p);
  }
  await page.keyboard.press('Escape');
  const lengths = await editorState(page, (s) =>
    s.data.doc.floors[0]!.walls.map((w) => Math.hypot(w.b.x - w.a.x, w.b.y - w.a.y)),
  );
  expect(lengths).toEqual([5, 4, 5, 4]);
  await expect(page.getByTestId('save-status')).toHaveText('Saved', { timeout: 5000 });
  await page.reload();
  await expect(page.getByTestId('project-name')).toBeVisible();
  expect(await editorState(page, (s) => s.data.doc.floors[0]!.walls.length)).toBe(4);
});

// protects=PDF import with page picker; fails_when=a multi-page PDF cannot be imported or the chosen page is ignored; no_claim=vector fidelity
test('import page 2 of a PDF as background', async ({ page }) => {
  await newProject(page, `PDF ${Date.now()}`);
  await page.getByTestId('empty-canvas').getByRole('button', { name: 'Import plan' }).click();
  await page.getByTestId('background-file').setInputFiles('tests/fixtures/plan-2-pages.pdf');
  await page.getByRole('option', { name: 'Page 2' }).click();
  await page.getByRole('button', { name: 'Use page 2' }).click();
  await expect(page.getByTestId('background-panel')).toBeVisible();
  const bg = await editorState(page, (s) => s.data.doc.floors[0]!.background!);
  expect(bg).toMatchObject({ kind: 'pdf', page: 2 });
  expect(Math.max(bg.widthPx, bg.heightPx)).toBeLessThanOrEqual(4096);
});
