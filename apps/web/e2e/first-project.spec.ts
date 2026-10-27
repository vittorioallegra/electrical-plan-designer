import { expect, test, type Page } from '@playwright/test';
import { clickWorld, editorState, newProject, start } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await start(page);
});

const progress = (page: Page) => page.getByTestId('progress-control');

async function expectNext(page: Page, stage: string) {
  await expect(progress(page)).toHaveAttribute('data-next', stage);
}

/** Opens the progress menu and picks a stage. */
async function openStage(page: Page, name: RegExp) {
  await progress(page).click();
  await page.getByRole('menuitem', { name }).click();
}

// protects=the first-project path (G1/G2 through the UI); fails_when=a stage of the progress control does not open its tool or the path does not end in a BOM with cable; no_claim=lengths (conduits.spec), background import (plan.spec)
test('first project: follow the progress control from walls to BOM', async ({ page }) => {
  await newProject(page, `First ${Date.now()}`);

  await expectNext(page, 'plan');
  await openStage(page, /^Plan/);
  for (const p of [
    { x: 0, y: 0 },
    { x: 8, y: 0 },
    { x: 8, y: 5 },
  ]) {
    await clickWorld(page, p);
  }
  await page.keyboard.press('Escape');

  await expectNext(page, 'panel');
  await openStage(page, /^Panel/);
  await clickWorld(page, { x: 1, y: 1 });
  await openStage(page, /^Panel/);
  await expect(page).toHaveURL(/\/panel$/);
  await page.getByRole('button', { name: 'Add MCB 1P+N C16' }).click();

  await expectNext(page, 'conduits');
  await openStage(page, /^Conduits/);
  await expect(page).toHaveURL(/\/plan$/);
  await clickWorld(page, { x: 1, y: 1 });
  await clickWorld(page, { x: 4, y: 1 });
  await page.keyboard.press('Enter');

  await expectNext(page, 'boxes');
  await openStage(page, /^Boxes/);
  await clickWorld(page, { x: 4, y: 4 });
  await page.getByTestId('tool-conduit').click();
  await clickWorld(page, { x: 4, y: 1 });
  await clickWorld(page, { x: 4, y: 4 });
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  expect(await editorState(page, (s) => s.data.doc.segments.length)).toBe(2);

  await expectNext(page, 'circuits');
  await openStage(page, /^Circuits/);
  await page.getByRole('button', { name: 'New circuit' }).click();
  await page.getByRole('button', { name: 'Pick targets on the plan' }).click();
  await clickWorld(page, { x: 4, y: 4 });
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('route-status')).toHaveText('2 segments');

  // Routing the circuit puts cable in the BOM, which completes the last stage.
  await expectNext(page, 'none');
  await progress(page).click();
  await expect(page.getByRole('menuitem', { name: /, done$/ })).toHaveCount(6);
  await page.getByRole('menuitem', { name: /^BOM/ }).click();
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
