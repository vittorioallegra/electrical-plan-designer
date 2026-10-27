import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import type * as ImportFile from '../src/features/editor/background/importFile';
import { clickWorld, dragWorld, editorState, fixture, newProject, start } from './helpers';

type ImportFileModule = typeof ImportFile;

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await start(page);
});

// protects=AC 2 import + calibration, dialog overlay above the bottom panel's tab bar; fails_when=a calibrated 4.20 m distance measures off by > 1 cm or the tab bar shows over the overlay; no_claim=PDF import
test('import a PNG, calibrate two points 4.20 m apart, and measure 4.20 m between them', async ({
  page,
}) => {
  await newProject(page, `AC2 ${Date.now()}`);
  await page
    .getByRole('toolbar', { name: 'Panels' })
    .getByRole('button', { name: 'Circuits' })
    .click();
  await page.getByTestId('empty-canvas').getByRole('button', { name: 'Import plan' }).click();
  // The dialog overlay covers the sticky tab bar of the bottom panel.
  const tab = await page.getByRole('tab', { name: 'Circuits', includeHidden: true }).boundingBox();
  const topmost = await page.evaluate(
    ({ x, y }) => document.elementFromPoint(x, y)?.getAttribute('data-testid') ?? null,
    { x: tab!.x + tab!.width / 2, y: tab!.y + tab!.height / 2 },
  );
  expect(topmost).toBe('dialog-overlay');
  await page.getByTestId('background-file').setInputFiles(fixture('plan-1000x800.png'));
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
  await expect(page.getByTestId('save-status')).toHaveText('Draft', { timeout: 5000 });
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
  await expect(page.getByTestId('save-status')).toHaveText('Draft', { timeout: 5000 });
});

// protects=PDF import with page picker; fails_when=a multi-page PDF cannot be imported or the chosen page is ignored; no_claim=vector fidelity
test('import page 2 of a PDF as background', async ({ page }) => {
  await newProject(page, `PDF ${Date.now()}`);
  await page.getByTestId('empty-canvas').getByRole('button', { name: 'Import plan' }).click();
  await page.getByTestId('background-file').setInputFiles(fixture('plan-2-pages.pdf'));
  await page.getByRole('option', { name: 'Page 2' }).click();
  await page.getByRole('button', { name: 'Use page 2' }).click();
  await expect(page.getByTestId('background-panel')).toBeVisible();
  const bg = await editorState(page, (s) => s.data.doc.floors[0]!.background!);
  expect(bg).toMatchObject({ kind: 'pdf', page: 2 });
  expect(Math.max(bg.widthPx, bg.heightPx)).toBeLessThanOrEqual(4096);
});

// protects=scanned PDFs (CCITT/JBIG2 images decoded by pdf.js wasm); fails_when=the scanned drawing is dropped and only vector content renders; no_claim=JPEG 2000 scans
test('renders the scanned image of a CCITT-encoded PDF', async ({ page }) => {
  const pdf = readFileSync(fixture('plan-ccitt.pdf')).toString('base64');
  const darkShare = await page.evaluate(async (base64) => {
    // Served by the e2e Vite dev server; a variable keeps TypeScript from resolving the path.
    const modulePath = '/src/features/editor/background/importFile.ts';
    const { openPdf } = (await import(/* @vite-ignore */ modulePath)) as ImportFileModule;
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const handle = await openPdf(new File([bytes], 'scan.pdf', { type: 'application/pdf' }));
    const { blob } = await handle.render(1);
    handle.destroy();
    const bitmap = await createImageBitmap(blob);
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext('2d')!;
    context.drawImage(bitmap, 0, 0);
    const { data } = context.getImageData(0, 0, bitmap.width, bitmap.height);
    let dark = 0;
    for (let i = 0; i < data.length; i += 4) if (data[i]! < 128) dark++;
    return dark / (data.length / 4);
  }, pdf);
  // The fixture's image is a black band over the middle half of the page.
  expect(darkShare).toBeGreaterThan(0.4);
  expect(darkShare).toBeLessThan(0.6);
});

// protects=one "Import plan" per state, panel collapse and the conduit legend in the real layout; fails_when=Import plan shows twice, a side panel does not collapse and give its width to the canvas, or the legend does not show and collapse; no_claim=theme colours
test('plan view: one Import plan, collapsible side panels, conduit legend', async ({ page }) => {
  await newProject(page, `View ${Date.now()}`);
  await expect(page.getByRole('button', { name: 'Import plan' })).toHaveCount(1);
  await expect(
    page.getByTestId('empty-canvas').getByRole('button', { name: 'Import plan' }),
  ).toBeVisible();

  await page.getByTestId('tool-wall').click();
  await clickWorld(page, { x: 0, y: 0 });
  await clickWorld(page, { x: 4, y: 0 });
  await page.keyboard.press('Escape');
  await page.getByTestId('tool-select').click();
  await expect(page.getByTestId('empty-canvas')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Import plan' })).toHaveCount(1);

  const canvasWidth = async () => (await page.getByTestId('canvas-area').boundingBox())!.width;
  const before = await canvasWidth();
  await page.getByRole('button', { name: 'Floors panel' }).click();
  await expect.poll(canvasWidth).toBeGreaterThan(before + 150);
  await page.getByRole('button', { name: 'Floors panel' }).click();
  await expect.poll(canvasWidth).toBeLessThan(before + 5);

  const legend = page.getByTestId('run-legend');
  await expect(legend.locator('line')).toHaveCount(3);
  await legend.getByRole('button', { name: 'Conduit runs' }).click();
  await expect(legend.locator('line')).toHaveCount(3);
  await expect(legend.getByText('At floor')).toBeHidden();
});

// protects=editing walls on the canvas; fails_when=dragging a wall or its end handle does not move it, drags its neighbour, misses the snap to a wall end, or takes more than one undo; no_claim=inspector fields (unit test)
test('move a wall and drag its end handle on the plan, one undo each', async ({ page }) => {
  await newProject(page, `Walls ${Date.now()}`);
  await page.getByTestId('tool-wall').click();
  await clickWorld(page, { x: 0, y: 0 });
  await clickWorld(page, { x: 4, y: 0 });
  await clickWorld(page, { x: 4, y: 3 });
  await page.keyboard.press('Escape');
  await page.getByTestId('tool-select').click();
  const walls = () =>
    editorState(page, (s) => s.data.doc.floors[0]!.walls.map(({ a, b }) => ({ a, b })));
  const drawn = await walls();
  const undoSteps = () => editorState(page, (s) => s.past.length);
  const steps = await undoSteps();

  // The body: the wall moves alone and ends up selected.
  await dragWorld(page, { x: 2, y: 0 }, { x: 2, y: 1 });
  expect(await walls()).toEqual([
    { a: { x: 0, y: 1 }, b: { x: 4, y: 1 } },
    { a: { x: 4, y: 0 }, b: { x: 4, y: 3 } },
  ]);
  const selected = await editorState(page, (s) => s.ui.selection);
  expect(selected).toEqual([await editorState(page, (s) => s.data.doc.floors[0]!.walls[0]!.id)]);
  await expect(page.getByTestId('wall-inspector')).toBeVisible();

  // The end handle: it turns the wall and snaps onto the other wall's end.
  await dragWorld(page, { x: 4, y: 1 }, { x: 4.05, y: 2.95 });
  expect((await walls())[0]).toEqual({ a: { x: 0, y: 1 }, b: { x: 4, y: 3 } });
  expect(await undoSteps()).toBe(steps + 2);

  await page.keyboard.press('ControlOrMeta+z');
  expect((await walls())[0]).toEqual({ a: { x: 0, y: 1 }, b: { x: 4, y: 1 } });
  await page.keyboard.press('ControlOrMeta+z');
  expect(await walls()).toEqual(drawn);
});
