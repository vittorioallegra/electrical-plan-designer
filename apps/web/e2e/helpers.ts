import { fileURLToPath } from 'node:url';
import { expect, type Page } from '@playwright/test';
import type { EditorState } from '../src/stores/editor/editorStore';

/** Absolute path of a shared file in the repo's tests/fixtures. */
export function fixture(name: string): string {
  return fileURLToPath(new URL(`../../../tests/fixtures/${name}`, import.meta.url));
}

/** Opens the start screen. */
export async function start(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Start' })).toBeVisible();
}

/** Creates a new project from the start screen (a file project, kept as a draft). */
export async function newProject(page: Page, name: string) {
  await page.getByRole('button', { name: 'New project' }).first().click();
  await page.getByLabel('Project name').fill(name);
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByTestId('project-name')).toHaveText(name);
}

/** Editor state through the E2E-only `window.__epd` handle. */
export async function editorState<T>(page: Page, pick: (state: EditorState) => T): Promise<T> {
  return page.evaluate(`(${pick.toString()})(window.__epd.store.getState())`) as Promise<T>;
}

/** Screen position (page coordinates) of a world point on the plan canvas. */
export async function screenOf(page: Page, world: { x: number; y: number }) {
  const view = await editorState(page, (s) => s.ui.view);
  const box = (await page.getByTestId('plan-canvas').boundingBox())!;
  return { x: box.x + view.x + world.x * view.scale, y: box.y + view.y + world.y * view.scale };
}

export async function clickWorld(page: Page, world: { x: number; y: number }, alt = false) {
  const p = await screenOf(page, world);
  if (alt) await page.keyboard.down('Alt');
  await page.mouse.move(p.x, p.y);
  await page.mouse.click(p.x, p.y);
  if (alt) await page.keyboard.up('Alt');
}
