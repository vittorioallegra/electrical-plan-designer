import { expect, test } from '@playwright/test';
import { clickWorld, dragWorld, editorState, newProject, start } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await start(page);
});

// protects=box columns on the canvas (spec box-columns AC 1, 4, 5, 6); fails_when=a box placed on a box does not join its column, a click does not explode the column into its boxes, a conduit to a column does not end on the box picked in the list, dragging leaves a box behind, or undo does not restore the column; no_claim=PDF drawing
test('stack two boxes, pick them from the exploded column, draw a conduit to one and drag the column', async ({
  page,
}) => {
  await newProject(page, `Columns ${Date.now()}`);
  await page.getByTestId('tool-panel').click();
  await clickWorld(page, { x: 1, y: 1 });
  await page.getByTestId('tool-terminal_box').click();
  await clickWorld(page, { x: 6, y: 1 });
  await clickWorld(page, { x: 6, y: 1 });

  // The second box joined the first one's column; make it a switch box (1.10 m).
  const boxes = () =>
    editorState(page, (s) => s.data.doc.nodes.filter((n) => n.kind === 'terminal_box'));
  const [low, high] = await boxes();
  expect(high!.stackId).toBeDefined();
  expect(high!.stackId).toBe(low!.stackId);
  await page.getByLabel('Mounting').click();
  await page.getByRole('option', { name: 'Switch' }).click();

  // One vertical conduit, 1.10 − 0.30 = 0.80 m, derived between them.
  const vertical = await editorState(page, (s) => s.data.doc.segments);
  expect(vertical).toHaveLength(1);
  expect(vertical[0]!.runElevation).toBe('direct');

  // A conduit from the panel to the column ends on the box picked in the list.
  await page.getByTestId('tool-conduit').click();
  await clickWorld(page, { x: 1, y: 1 });
  await clickWorld(page, { x: 6, y: 1 });
  const list = page.getByTestId('column-list');
  await expect(list).toBeVisible();
  await list.getByRole('button', { name: new RegExp(`^${low!.label}`) }).click();
  await expect(list).toBeHidden();
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  const toLow = await editorState(page, (s) =>
    s.data.doc.segments.filter((x) => x.runElevation !== 'direct').map((x) => x.toNodeId),
  );
  expect(toLow).toEqual([low!.id]);

  // Select: a click explodes the column; a row selects that box and the list stays open.
  await page.getByTestId('tool-select').click();
  await clickWorld(page, { x: 6, y: 1 });
  await expect(list).toBeVisible();
  await expect(list.getByRole('button')).toHaveCount(2);
  await list.getByRole('button', { name: new RegExp(`^${high!.label}`) }).click();
  expect(await editorState(page, (s) => s.ui.selection)).toEqual([high!.id]);
  await expect(list).toBeVisible();
  await expect(page.getByTestId('column-section')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(list).toBeHidden();

  // Dragging the column moves both boxes, without exploding it; undo puts them back.
  await dragWorld(page, { x: 6, y: 1 }, { x: 6, y: 3 });
  await expect(list).toBeHidden();
  const moved = await boxes();
  expect(moved.map((n) => n.position)).toEqual([
    { x: 6, y: 3 },
    { x: 6, y: 3 },
  ]);
  await page.keyboard.press('Control+z');
  expect((await boxes()).map((n) => n.position.y)).toEqual([1, 1]);
});
