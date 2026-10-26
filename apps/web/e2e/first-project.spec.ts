import { expect, test, type Page } from '@playwright/test';
import { clickWorld, editorState, newProject, start } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await start(page);
});

const strip = (page: Page) => page.getByRole('navigation', { name: 'Progress' });

async function expectNext(page: Page, stage: string) {
  await expect(strip(page).locator('[aria-current="step"]')).toHaveText(new RegExp(stage));
}

// protects=the first-project path (G1/G2 through the UI); fails_when=a stage of the progress strip does not open its tool or the path does not end in a BOM with cable; no_claim=lengths (conduits.spec), background import (plan.spec)
test('first project: follow the progress strip from walls to BOM', async ({ page }) => {
  await newProject(page, `First ${Date.now()}`);

  await expectNext(page, 'Plan');
  await strip(page).getByRole('button', { name: /Plan/ }).click();
  for (const p of [
    { x: 0, y: 0 },
    { x: 8, y: 0 },
    { x: 8, y: 5 },
  ]) {
    await clickWorld(page, p);
  }
  await page.keyboard.press('Escape');

  await expectNext(page, 'Panel');
  await strip(page).getByRole('button', { name: /Panel/ }).click();
  await clickWorld(page, { x: 1, y: 1 });
  await strip(page).getByRole('button', { name: /Panel/ }).click();
  await expect(page).toHaveURL(/\/panel$/);
  await page.getByRole('button', { name: 'Add MCB 1P+N C16' }).click();

  await expectNext(page, 'Conduits');
  await strip(page)
    .getByRole('button', { name: /Conduits/ })
    .click();
  await expect(page).toHaveURL(/\/plan$/);
  await clickWorld(page, { x: 1, y: 1 });
  await clickWorld(page, { x: 4, y: 1 });
  await page.keyboard.press('Enter');

  await expectNext(page, 'Boxes');
  await strip(page).getByRole('button', { name: /Boxes/ }).click();
  await clickWorld(page, { x: 4, y: 4 });
  await page.getByTestId('tool-conduit').click();
  await clickWorld(page, { x: 4, y: 1 });
  await clickWorld(page, { x: 4, y: 4 });
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  expect(await editorState(page, (s) => s.data.doc.segments.length)).toBe(2);

  await expectNext(page, 'Circuits');
  await strip(page)
    .getByRole('button', { name: /Circuits/ })
    .click();
  await page.getByRole('button', { name: 'New circuit' }).click();
  await page.getByRole('button', { name: 'Pick targets on the plan' }).click();
  await clickWorld(page, { x: 4, y: 4 });
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('route-status')).toHaveText('2 segments');

  // Routing the circuit puts cable in the BOM, which completes the last stage.
  await expect(strip(page).locator('[data-state="done"]')).toHaveCount(6);
  await strip(page).getByRole('button', { name: /BOM/ }).click();
  await expect(page.getByRole('region', { name: 'Cable' })).toContainText('2.5 mm² brown');

  // The new box has no plate or devices: its warning brings it to the middle of the canvas.
  await page.getByRole('tab', { name: /^Warnings/ }).click();
  await page
    .getByRole('region', { name: 'Boxes without plate or devices' })
    .getByRole('button')
    .click();
  const boxId = await editorState(
    page,
    (s) => s.data.doc.nodes.find((n) => n.kind === 'terminal_box')!.id,
  );
  expect(await editorState(page, (s) => s.ui.selection)).toEqual([boxId]);
  const canvas = (await page.getByTestId('plan-canvas').boundingBox())!;
  const view = await editorState(page, (s) => s.ui.view);
  expect(view.x + 4 * view.scale).toBeCloseTo(canvas.width / 2, 0);
  expect(view.y + 4 * view.scale).toBeCloseTo(canvas.height / 2, 0);
  await expect(page.getByTestId('save-status')).toHaveText('Draft', { timeout: 5000 });
});
