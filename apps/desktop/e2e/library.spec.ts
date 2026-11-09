import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { launchApp, stubSaveDialog, type LaunchedApp, removeDir } from './helpers';

const library = (userData: string, ...parts: string[]) => join(userData, 'library', ...parts);

async function openLibrary(page: Page, section: 'Company' | 'Catalog') {
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('link', { name: section, exact: true }).click();
  await expect(page.getByRole('heading', { name: section })).toBeVisible();
}

async function addOwnItem(page: Page, name: string) {
  await page.getByRole('button', { name: 'New item' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Name').fill(name);
  await dialog.getByLabel('Code').fill('BR-1');
  await dialog.getByLabel('Unit price').fill('4.50');
  await dialog.getByLabel('Modules').fill('1');
  await dialog.getByRole('combobox', { name: 'Device type' }).click();
  await page.getByRole('option', { name: 'Socket', exact: true }).click();
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('gridcell', { name })).toBeVisible();
}

// protects=AC 10 persistence; fails_when=company data, a "My items" catalog item or the logo set in the library are not in the files under userData/library, or are gone after a restart; no_claim=every library section (unit-tested), projects reading the library (unit-tested)
test('the library survives a restart', async () => {
  const userData = mkdtempSync(join(tmpdir(), 'epd-library-e2e-'));
  const launched: LaunchedApp[] = [];
  try {
    const first = await launchApp(userData);
    launched.push(first);
    await openLibrary(first.page, 'Company');
    await first.page.getByLabel('Business name').fill('Elettricità Rossi');
    await first.page.getByLabel('VAT number').fill('IT01234567890');
    await first.page.getByLabel('VAT number').blur();
    const png = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');
    await first.page
      .getByLabel('Logo')
      .setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: png });
    await first.page.getByRole('link', { name: 'Catalog', exact: true }).click();
    await addOwnItem(first.page, 'Brand socket');

    await expect
      .poll(
        () =>
          existsSync(library(userData, 'logo.png')) &&
          existsSync(library(userData, 'catalogs', 'own.json')),
      )
      .toBe(true);
    const core = JSON.parse(readFileSync(library(userData, 'library.json'), 'utf8')) as {
      company: { businessName: string };
    };
    expect(core.company.businessName).toBe('Elettricità Rossi');
    expect(readdirSync(library(userData, 'catalogs'))).toEqual(['own.json']);
    await first.close();

    const second = await launchApp(userData);
    launched.push(second);
    await openLibrary(second.page, 'Company');
    await expect(second.page.getByLabel('Business name')).toHaveValue('Elettricità Rossi');
    await expect(second.page.getByLabel('VAT number')).toHaveValue('IT01234567890');
    await expect(second.page.getByRole('img', { name: 'Logo' })).toBeVisible();
    await second.page.getByRole('link', { name: 'Catalog', exact: true }).click();
    await expect(second.page.getByRole('gridcell', { name: 'Brand socket' })).toBeVisible();
  } finally {
    for (const app of launched) await app.close().catch(() => undefined);
    removeDir(userData);
  }
});

// protects=AC 10 invalid files are never overwritten; fails_when=an invalid library.json or catalog is deleted, overwritten or loaded, the rest of the library is lost, or no notice is shown; no_claim=the wording of the notice
test('an invalid library file is set aside with a notice and never overwritten', async () => {
  const userData = mkdtempSync(join(tmpdir(), 'epd-library-e2e-'));
  mkdirSync(library(userData, 'catalogs'), { recursive: true });
  writeFileSync(library(userData, 'library.json'), '{"schemaVersion":1,"company":7}');
  const launched: LaunchedApp[] = [];
  try {
    const first = await launchApp(userData);
    launched.push(first);
    await expect(first.page.getByRole('status')).toContainText('library.json.invalid-');
    const aside = readdirSync(library(userData)).filter((n) =>
      n.startsWith('library.json.invalid-'),
    );
    expect(aside).toHaveLength(1);
    expect(readFileSync(library(userData, aside[0]!), 'utf8')).toBe(
      '{"schemaVersion":1,"company":7}',
    );

    // The app works with defaults, and a change writes a fresh library.json beside the set-aside one.
    await openLibrary(first.page, 'Company');
    await expect(first.page.getByLabel('Business name')).toHaveValue('');
    await first.page.getByLabel('Business name').fill('Bianchi');
    await first.page.getByLabel('Business name').blur();
    await expect
      .poll(() =>
        existsSync(library(userData, 'library.json'))
          ? readFileSync(library(userData, 'library.json'), 'utf8')
          : '',
      )
      .toContain('Bianchi');
    expect(readFileSync(library(userData, aside[0]!), 'utf8')).toBe(
      '{"schemaVersion":1,"company":7}',
    );
  } finally {
    for (const app of launched) await app.close().catch(() => undefined);
    removeDir(userData);
  }
});

// protects=AC 17 export then import on a fresh install; fails_when=an exported .epl does not restore company, logo and catalogs on an empty app data folder, the old library is not copied to library.backup-*, or an invalid .epl changes the library; no_claim=the .epl zip layout (unit-tested)
test('export the library, import it on a fresh install; an invalid file is refused', async () => {
  const source = mkdtempSync(join(tmpdir(), 'epd-library-src-'));
  const target = mkdtempSync(join(tmpdir(), 'epd-library-dst-'));
  const outDir = mkdtempSync(join(tmpdir(), 'epd-library-out-'));
  const epl = join(outDir, 'library.epl');
  const broken = join(outDir, 'broken.epl');
  writeFileSync(broken, 'not a zip');
  const launched: LaunchedApp[] = [];
  try {
    const first = await launchApp(source);
    launched.push(first);
    await openLibrary(first.page, 'Company');
    await first.page.getByLabel('Business name').fill('Elettricità Rossi');
    await first.page.getByLabel('Business name').blur();
    const png = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');
    await first.page
      .getByLabel('Logo')
      .setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: png });
    await first.page.getByRole('link', { name: 'Catalog', exact: true }).click();
    await addOwnItem(first.page, 'Brand socket');
    await expect.poll(() => existsSync(library(source, 'catalogs', 'own.json'))).toBe(true);
    await stubSaveDialog(first.app, epl);
    await first.page.getByRole('button', { name: 'Export settings…' }).click();
    await expect.poll(() => existsSync(epl)).toBe(true);

    const second = await launchApp(target);
    launched.push(second);
    await openLibrary(second.page, 'Company');
    await second.page.getByLabel('Business name').fill('Old company');
    await second.page.getByLabel('Business name').blur();
    await expect.poll(() => existsSync(library(target, 'library.json'))).toBe(true);

    await second.page.getByTestId('library-file').setInputFiles(broken);
    await expect(
      second.page.getByText('This is not a settings file.', { exact: true }),
    ).toBeVisible();
    await expect(second.page.getByRole('dialog')).toHaveCount(0);
    await expect(second.page.getByLabel('Business name')).toHaveValue('Old company');

    await second.page.getByTestId('library-file').setInputFiles(epl);
    await second.page.getByRole('dialog').getByRole('button', { name: 'Replace settings' }).click();
    await expect(second.page.getByLabel('Business name')).toHaveValue('Elettricità Rossi');
    await expect(second.page.getByRole('img', { name: 'Logo' })).toBeVisible();
    await second.page.getByRole('link', { name: 'Catalog', exact: true }).click();
    await expect(second.page.getByRole('gridcell', { name: 'Brand socket' })).toBeVisible();

    const backups = readdirSync(target).filter((n) => n.startsWith('library.backup-'));
    expect(backups).toHaveLength(1);
    expect(readFileSync(join(target, backups[0]!, 'library.json'), 'utf8')).toContain(
      'Old company',
    );
    expect(readFileSync(library(target, 'library.json'), 'utf8')).toContain('Elettricità Rossi');
    expect(existsSync(library(target, 'logo.png'))).toBe(true);
  } finally {
    for (const app of launched) await app.close().catch(() => undefined);
    for (const dir of [source, target, outDir]) removeDir(dir);
  }
});
