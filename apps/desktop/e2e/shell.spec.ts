import { expect, test } from '@playwright/test';
import { launchApp, type LaunchedApp } from './helpers';

// protects=the desktop shell serves the built app over app:// with a locked-down window; fails_when=the start screen does not show, a deep route breaks on reload, a request leaves the app scheme, or the window gets node access or a bridge with members; no_claim=menus, files, recovery, library, packaging
test('starts on app://, reloads a deep route and keeps every request inside the app', async () => {
  let launched: LaunchedApp | undefined;
  try {
    launched = await launchApp();
    const { page } = launched;
    const requests: string[] = [];
    page.on('request', (r) => requests.push(r.url()));

    await expect(page.getByRole('heading', { name: 'Start' })).toBeVisible();
    expect(page.url()).toMatch(/^app:\/\/epd\//);

    // A deep route has no file behind it: the scheme handler falls back to index.html.
    await page.goto('app://epd/project/plan');
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Start' })).toBeVisible();

    const isolation = await page.evaluate(() => ({
      require: typeof (window as { require?: unknown }).require,
      process: typeof (window as { process?: unknown }).process,
      bridge: typeof window.epd,
    }));
    expect(isolation).toEqual({ require: 'undefined', process: 'undefined', bridge: 'object' });

    expect(requests.length).toBeGreaterThan(0);
    expect(requests.filter((u) => !/^(app|data|blob):/.test(u))).toEqual([]);
  } finally {
    await launched?.close();
  }
});
