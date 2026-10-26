import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { strFromU8, unzipSync } from 'fflate';
import { expect, type Page } from '@playwright/test';
import type { ProjectFile } from '@epd/domain/projectFile';
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

/** Puts a file into the app's fake file access and has the next "Open file…" pick it. */
export async function offerFile(page: Page, name: string, bytes: Uint8Array) {
  await page.evaluate(
    ([name, bytes]) => {
      const files = window.__epd!.files!;
      files.files.set(name, new Uint8Array(bytes));
      files.nextOpen = name;
    },
    [name, [...bytes]] as const,
  );
}

/** A fixture `.epd` offered to the next "Open file…". */
export async function offerFixture(page: Page, name: string) {
  await offerFile(page, name, new Uint8Array(readFileSync(fixture(name))));
}

/** Bytes the app saved to a file of the fake file access, or null when there is none. */
export async function savedBytes(page: Page, name: string): Promise<Uint8Array | null> {
  const bytes = await page.evaluate((n) => {
    const file = window.__epd!.files!.files.get(n);
    return file ? [...file] : null;
  }, name);
  return bytes && new Uint8Array(bytes);
}

/** Paths of the files in the fake file access. */
export async function fileNames(page: Page): Promise<string[]> {
  return page.evaluate(() => [...window.__epd!.files!.files.keys()]);
}

/** The project.json of an `.epd` file. */
export function projectOf(epd: Uint8Array): ProjectFile {
  return JSON.parse(strFromU8(unzipSync(epd)['project.json']!)) as ProjectFile;
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
