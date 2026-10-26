import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import {
  editorState,
  fixture,
  newProject,
  offerFile,
  offerFixture,
  projectOf,
  savedBytes,
  start,
} from './helpers';

// protects=AC 1 save and reopen; fails_when=a project saved to its file and reopened differs in drawing, settings, company, catalogs or quotes, or the draft is not offered after a reload; no_claim=the File System Access permission prompts (fake file access)
test('open the demo file, edit, save it and reopen it', async ({ page }) => {
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
  const bytes = (await savedBytes(page, 'demo-project.epd'))!;
  const saved = projectOf(bytes);
  const open = await editorState(page, (s) => s.data);
  expect(saved).toEqual(open);
  expect(saved.doc.floors).toHaveLength(floors + 1);
  expect(saved.catalogs.length).toBeGreaterThan(0);
  expect(saved.company.businessName).not.toBe('');

  // A reload closes the project; the draft is offered and matches the saved file.
  await page.reload();
  const draft = page.getByRole('region', { name: 'Draft on this device' });
  await expect(draft).toContainText('Demo house');
  await expect(draft).not.toContainText('changes not saved to a file');

  // Reopening the saved file gives the same project (the fake files start empty after a reload).
  await offerFile(page, 'demo-project.epd', bytes);
  await page.getByRole('button', { name: 'Open file…' }).click();
  await expect(page.getByTestId('project-name')).toHaveText('Demo house');
  expect(await editorState(page, (s) => s.data)).toEqual(open);
});

// protects=Save as for a new project; fails_when=a project without a file is not written as <name>.epd, or the file does not hold the project; no_claim=the browser save dialog
test('save a new project as a file', async ({ page }) => {
  await start(page);
  const name = `Saved ${Date.now()}`;
  await newProject(page, name);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByTestId('save-status')).toHaveText('Saved');
  const file = `${name.replace(/ /g, '-')}.epd`;
  expect(projectOf((await savedBytes(page, file))!).meta.name).toBe(name);
  await expect(page.getByText(`Saved to ${file}`).first()).toBeVisible();
});

// protects=browsers without the File System Access API; fails_when=a project cannot be opened through the file input or Save does not download it; no_claim=Firefox and Safari themselves (Chromium with the API removed)
test('open with the file input and save by download', async ({ page }) => {
  await page.addInitScript(() => {
    window.__epdRealFiles = true;
    const w = window as unknown as Record<string, unknown>;
    delete w.showOpenFilePicker;
    delete w.showSaveFilePicker;
  });
  await start(page);
  await expect(page.getByRole('note')).toContainText('Chrome or Edge are recommended');

  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Open file…' }).click();
  await (await chooser).setFiles(fixture('demo-project.epd'));
  await expect(page.getByTestId('project-name')).toHaveText('Demo house');

  await page.getByRole('button', { name: 'Add floor' }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe('demo-project.epd');
  const project = projectOf(new Uint8Array(await readFile(await file.path())));
  expect(project.doc.floors).toHaveLength(await editorState(page, (s) => s.data.doc.floors.length));
  await expect(page.getByTestId('save-status')).toHaveText('Saved');
});
