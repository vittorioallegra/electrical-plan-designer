import { readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { clickMenu, launchApp, type LaunchedApp } from './helpers';

/** The stored preferences, empty until main has written the file. */
function storedPreferences(userData: string): unknown {
  try {
    return JSON.parse(readFileSync(join(userData, 'preferences.json'), 'utf8'));
  } catch {
    return {};
  }
}

const prefersDark = (page: Page) =>
  page.evaluate(() => window.matchMedia('(prefers-color-scheme: dark)').matches);

/** Records the themes the page is told about (`preferences.onThemeChanged`). */
async function listen(page: Page): Promise<void> {
  await page.evaluate(() => {
    const heard: string[] = [];
    (window as unknown as { heard: string[] }).heard = heard;
    window.epd!.preferences.onThemeChanged((theme) => heard.push(theme));
  });
}
const heard = (page: Page) => page.evaluate(() => (window as unknown as { heard: string[] }).heard);

// protects=the theme preference is stored by main, drives nativeTheme and reaches every window; fails_when=setTheme from one window does not change the CSS media query of both, is not announced to the other window, is not written to preferences.json, or a new window opens on the wrong theme; no_claim=the Settings control (step 6) and a restart
test('a theme change reaches every window and is stored', async () => {
  let launched: LaunchedApp | undefined;
  try {
    launched = await launchApp();
    const { app, page, userData } = launched;
    await expect(page.getByRole('heading', { name: 'Start' })).toBeVisible();
    expect(await page.evaluate(() => window.epd!.preferences.getTheme())).toBe('system');

    const secondOpened = app.waitForEvent('window');
    await app.evaluate(() => (globalThis as { epdOpenWindow?: () => void }).epdOpenWindow!());
    const second = await secondOpened;
    await expect(second.getByRole('heading', { name: 'Start' })).toBeVisible();
    await listen(page);
    await listen(second);

    await page.evaluate(() => window.epd!.preferences.setTheme('light'));
    await expect.poll(() => prefersDark(page)).toBe(false);
    await expect.poll(() => prefersDark(second)).toBe(false);

    await page.evaluate(() => window.epd!.preferences.setTheme('dark'));
    await expect.poll(() => prefersDark(page)).toBe(true);
    await expect.poll(() => prefersDark(second)).toBe(true);
    await expect.poll(() => heard(page)).toEqual(['light', 'dark']);
    await expect.poll(() => heard(second)).toEqual(['light', 'dark']);
    expect(await second.evaluate(() => window.epd!.preferences.getTheme())).toBe('dark');

    expect(await app.evaluate(({ nativeTheme }) => nativeTheme.themeSource)).toBe('dark');
    expect(JSON.parse(readFileSync(join(userData, 'preferences.json'), 'utf8'))).toMatchObject({
      theme: 'dark',
    });

    // A rejected value changes nothing.
    await expect(
      page.evaluate(() => window.epd!.preferences.setTheme('purple' as never)),
    ).rejects.toThrow();
    expect(await page.evaluate(() => window.epd!.preferences.getTheme())).toBe('dark');
  } finally {
    await launched?.close();
  }
});

// protects=the theme chosen in Settings survives a restart; fails_when=the Settings control does not reach preferences.json, or a relaunch with the same user data opens on another theme than the stored one (CSS media query and nativeTheme); no_claim=the control's own states (unit test)
test('the theme chosen in Settings is applied again after a restart', async () => {
  let first: LaunchedApp | undefined;
  let second: LaunchedApp | undefined;
  try {
    first = await launchApp();
    const { page, userData } = first;
    await page.getByRole('button', { name: 'Settings' }).click();
    await page.getByRole('radio', { name: 'Dark' }).click();
    await expect.poll(() => prefersDark(page)).toBe(true);
    await expect.poll(() => storedPreferences(userData)).toMatchObject({ theme: 'dark' });
    await first.app.close();

    second = await launchApp(userData);
    await expect(second.page.getByRole('heading', { name: 'Start' })).toBeVisible();
    expect(await prefersDark(second.page)).toBe(true);
    expect(await second.app.evaluate(({ nativeTheme }) => nativeTheme.themeSource)).toBe('dark');
    await second.page.getByRole('button', { name: 'Settings' }).click();
    await expect(second.page.getByRole('radio', { name: 'Dark' })).toBeChecked();
  } finally {
    await second?.close().catch(() => undefined);
    await first?.close().catch(() => undefined);
    if (first) rmSync(first.userData, { recursive: true, force: true });
  }
});

// protects=on macOS the Settings menu item works with no window open; fails_when=choosing Settings after the last window is closed opens nothing, or a window that does not land on Settings General; no_claim=Windows and Linux (the app quits with its last window)
test('Settings from the macOS menu opens a window when none is open', async () => {
  let launched: LaunchedApp | undefined;
  try {
    launched = await launchApp();
    const { app, page } = launched;
    test.skip(process.platform !== 'darwin', 'only macOS keeps the app running without a window');
    await expect(page.getByRole('heading', { name: 'Start' })).toBeVisible();
    const closed = page.waitForEvent('close');
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.close());
    await closed;
    expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)).toBe(0);

    const opened = app.waitForEvent('window');
    await clickMenu(app, 'Electrical Plan Designer', 'Settings…');
    const window = await opened;
    await expect(window).toHaveURL(/\/settings\/general$/);
    await expect(window.getByRole('radio', { name: 'System' })).toBeVisible();
  } finally {
    await launched?.close().catch(() => undefined);
  }
});
