import { expect, test } from '@playwright/test';
import {
  editorState,
  newProject,
  offerFile,
  offerFixture,
  projectOf,
  fileNames,
  savedBytes,
  start,
} from './helpers';

// protects=AC 1 save and reopen; fails_when=a project saved to its file and reopened differs in drawing, settings, item copies or quotes, or the draft is not offered after a reload; no_claim=the File System Access permission prompts (fake file access)
test('open the demo file, edit, save it in place and reopen it', async ({ page }) => {
  await start(page);
  await offerFixture(page, 'demo-project.epd');
  await page.getByRole('button', { name: 'Open file…' }).click();
  await expect(page.getByTestId('project-name')).toHaveText('Demo house');
  await expect(page.getByTestId('save-status')).toHaveText('Saved');
  const floors = await editorState(page, (s) => s.data.doc.floors.length);

  await page.getByRole('button', { name: 'Add floor' }).click();
  await expect(page.getByTestId('save-status')).toHaveText('Draft', { timeout: 5000 });
  await page.keyboard.press('Control+s');
  await expect(page.getByTestId('save-status')).toHaveText('Saved');
  // Save writes the opened file in place; no other file appears.
  const bytes = (await savedBytes(page, 'demo-project.epd'))!;
  expect(await fileNames(page)).toEqual(['demo-project.epd']);
  const saved = projectOf(bytes);
  const open = await editorState(page, (s) => s.data);
  expect(saved).toEqual(open);
  expect(saved.doc.floors).toHaveLength(floors + 1);
  expect(saved.items.length).toBeGreaterThan(0);
  expect(Object.keys(saved).sort()).toEqual(
    ['cablePrices', 'doc', 'items', 'meta', 'quote', 'settings'].sort(),
  );

  // A reload closes the project (the fake files start empty); reopening the saved file gives
  // the same project.
  await page.reload();
  await offerFile(page, 'demo-project.epd', bytes);
  await page.getByRole('button', { name: 'Open file…' }).click();
  await expect(page.getByTestId('project-name')).toHaveText('Demo house');
  expect(await editorState(page, (s) => s.data)).toEqual(open);
});

// protects=saving a new project; fails_when=a new project is not saved through Save As as <name>.epd, or the file does not hold the project; no_claim=the native save dialog (Electron E2E)
test('save a new project as a file', async ({ page }) => {
  await start(page);
  const name = `Saved ${Date.now()}`;
  await newProject(page, name);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByTestId('save-status')).toHaveText('Saved');
  const file = `${name.replace(/ /g, '-')}.epd`;
  expect(projectOf((await savedBytes(page, file))!).meta.name).toBe(name);
  await expect(page.getByText(`Saved: ${file}`).first()).toBeVisible();
});

// protects=AC 4 changed on disk in the browser build; fails_when=Save overwrites a file another program changed without asking; no_claim=real disks (Electron E2E)
test('ask before overwriting a file that changed on disk', async ({ page }) => {
  await start(page);
  await offerFixture(page, 'demo-project.epd');
  await page.getByRole('button', { name: 'Open file…' }).click();
  await expect(page.getByTestId('project-name')).toHaveText('Demo house');
  await page.getByRole('button', { name: 'Add floor' }).click();
  await page.evaluate(() => window.__epd!.files!.touch('demo-project.epd', new Uint8Array([1])));
  await page.keyboard.press('Control+s');
  await expect(page.getByRole('dialog', { name: 'The file changed on disk' })).toBeVisible();
  expect(await savedBytes(page, 'demo-project.epd')).toEqual(new Uint8Array([1]));
  await page.getByRole('button', { name: 'Overwrite' }).click();
  await expect(page.getByTestId('save-status')).toHaveText('Saved');
});
