import { expect, test } from '@playwright/test';
import { editorState, newProject, start } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await start(page);
});

// protects=the bottom panel of the editor shell; fails_when=the panel starts open, a status bar button does not open it on its tab, dragging its separator down does not collapse it, or the open state is lost; no_claim=the slide animation
test('the bottom panel opens from the status bar and collapses when dragged shut', async ({
  page,
}) => {
  await newProject(page, `Shell ${Date.now()}`);
  const panel = page.getByRole('region', {
    name: /Circuits, bill of materials/,
    includeHidden: true,
  });
  const height = async () => (await panel.boundingBox())?.height ?? 0;
  await expect.poll(height).toBe(0);
  await expect(page.getByTestId('status-warnings-count')).toHaveText('0');

  await page.getByRole('toolbar', { name: 'Panels' }).getByRole('button', { name: 'BOM' }).click();
  await expect(page.getByRole('tab', { name: 'BOM', selected: true })).toBeVisible();
  await expect.poll(height).toBeGreaterThan(150);
  expect(await editorState(page, (s) => s.ui.drawerOpen)).toBe(true);

  const separator = page.getByTestId('drawer-separator');
  const box = (await separator.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + 600, { steps: 8 });
  await page.mouse.up();
  await expect.poll(height).toBe(0);
  await expect.poll(() => editorState(page, (s) => s.ui.drawerOpen)).toBe(false);

  await page.getByRole('toolbar', { name: 'Panels' }).getByRole('button', { name: 'BOM' }).click();
  await expect.poll(height).toBeGreaterThan(60);
});

// protects=the bottom panel reopens at the height it had before a drag shut it; fails_when=reopening after a drag-to-close uses the minimum height; no_claim=exact pixel heights
test('the bottom panel reopens at its previous height after being dragged shut', async ({
  page,
}) => {
  await newProject(page, `Shell ${Date.now()}`);
  const panel = page.getByRole('region', {
    name: /Circuits, bill of materials/,
    includeHidden: true,
  });
  const height = async () => (await panel.boundingBox())?.height ?? 0;
  const bomButton = page
    .getByRole('toolbar', { name: 'Panels' })
    .getByRole('button', { name: 'BOM' });
  const dragSeparator = async (dy: number) => {
    const box = (await page.getByTestId('drawer-separator').boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y + dy, { steps: 12 });
    await page.mouse.up();
  };

  await bomButton.click();
  await expect.poll(height).toBeGreaterThan(150);
  await dragSeparator(-150);
  await expect.poll(height).toBeGreaterThan(300);
  await page.waitForTimeout(300);
  const before = await height();

  await dragSeparator(600);
  await expect.poll(height).toBe(0);
  await bomButton.click();
  await expect.poll(async () => Math.abs((await height()) - before)).toBeLessThan(25);
});
