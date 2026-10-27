import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { launchApp, type LaunchedApp } from './helpers';

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
