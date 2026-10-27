import { expect, test, type Page } from '@playwright/test';
import { launchApp, openProjectFile, tempProject, type LaunchedApp } from './helpers';

/** The nearest `app-region` set on the element or an ancestor ('none' when nothing sets one). */
async function regionOf(page: Page, selector: string): Promise<string[]> {
  return page.evaluate((sel) => {
    const out: string[] = [];
    for (const el of document.querySelectorAll(sel)) {
      let node: Element | null = el;
      let region = 'none';
      while (node && region === 'none') {
        region = getComputedStyle(node).getPropertyValue('-webkit-app-region') || 'none';
        node = node.parentElement;
      }
      out.push(region);
    }
    return out;
  }, selector);
}

// protects=the macOS hiddenInset title bar; fails_when=a title bar control sits in a drag region (it would swallow the click), a control does not react to a click, the start screen loses its drag strip, or full screen keeps the traffic light inset; no_claim=real window dragging (OS level), the Windows frame
test('title bar controls are no-drag and work, the other pages get the drag strip, full screen drops the inset', async () => {
  const project = tempProject();
  let launched: LaunchedApp | undefined;
  try {
    launched = await launchApp();
    const { page, app } = launched;
    const mac = process.platform === 'darwin';
    expect(await page.evaluate(() => window.epd?.platform)).toBe(process.platform);

    // Start screen: a drag strip on macOS only.
    await expect(page.getByRole('heading', { name: 'Start' })).toBeVisible();
    const strip = page.getByTestId('title-bar-strip');
    if (mac) {
      await expect(strip).toHaveCSS('height', '40px');
      expect(await regionOf(page, '[data-testid="title-bar-strip"]')).toEqual(['drag']);
    } else {
      await expect(strip).toHaveCount(0);
    }

    await openProjectFile(launched, project.path);
    const header = page.locator('header');
    expect(await regionOf(page, 'header')).toEqual(['drag']);
    const controls = 'header button, header a';
    expect(await page.locator(controls).count()).toBeGreaterThan(4);
    expect(new Set(await regionOf(page, controls))).toEqual(new Set(['no-drag']));

    // Real clicks on the controls.
    await header.getByRole('link', { name: 'Panel' }).click();
    await expect(page).toHaveURL(/\/project\/panel$/);
    await header.getByRole('link', { name: 'Plan' }).click();
    await expect(page).toHaveURL(/\/project\/plan$/);
    await header.getByRole('button', { name: 'Export' }).click();
    await expect(page.getByRole('menuitem', { name: 'Download project JSON' })).toBeVisible();
    await page.keyboard.press('Escape');
    await header.getByRole('button', { name: 'Project menu' }).click();
    await expect(page.getByRole('menuitem', { name: 'Close project' })).toBeVisible();
    await page.keyboard.press('Escape');
    await header.getByRole('button', { name: 'Settings' }).click();
    await expect(page).toHaveURL(/\/settings\/general$/);
    if (mac) {
      await expect(strip).toHaveCSS('height', '40px');
      expect(await regionOf(page, '[data-testid="title-bar-strip"]')).toEqual(['drag']);
    }
    await page.getByRole('link', { name: /^Back to / }).click();

    if (mac) {
      // The traffic lights need room, except in full screen.
      await expect(header).toHaveCSS('padding-left', '84px');
      // The OS may refuse full screen (a locked screen), so the window's own events are emitted.
      await app.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()[0]!.emit('enter-full-screen'),
      );
      await expect(header).toHaveCSS('padding-left', '12px', { timeout: 15_000 });
      await app.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()[0]!.emit('leave-full-screen'),
      );
      await expect(header).toHaveCSS('padding-left', '84px', { timeout: 15_000 });
    }
  } finally {
    await launched?.close().catch(() => undefined);
    project.cleanup();
  }
});
