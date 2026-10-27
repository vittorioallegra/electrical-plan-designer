import { expect, test, type Page } from '@playwright/test';
import { editorState, offerFixture, start } from './helpers';

const routes = [
  '/',
  '/settings/general',
  '/settings/company',
  '/settings/catalog',
  '/settings/presets',
  '/settings/new-projects',
  '/project/plan',
  '/project/panel',
  '/project/quote',
  '/project/details',
];

/** Opens the demo project from the start screen, so the project routes have something to show. */
async function openDemo(page: Page, openLabel = 'Open file…') {
  await page.goto('/');
  await expect(page.getByRole('button', { name: openLabel })).toBeVisible();
  await offerFixture(page, 'demo-project.epd');
  await page.getByRole('button', { name: openLabel }).click();
  await expect(page.getByTestId('project-name')).toHaveText('Demo house');
}

/** Moves to a route inside the running app (a reload would close the project). */
async function go(page: Page, path: string) {
  const heading = () => page.evaluate(() => document.querySelector('h1')?.textContent ?? '');
  const before = await heading();
  await page.evaluate((to) => {
    history.pushState({}, '', to);
    dispatchEvent(new PopStateEvent('popstate'));
  }, path);
  // Every page has its own h1: the new route is on screen once it differs.
  await expect.poll(async () => ((await heading()) !== before ? 'moved' : before)).toBe('moved');
  await page.waitForLoadState('networkidle');
}

const rgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${n >> 16}, ${(n >> 8) & 255}, ${n & 255})`;
};

test.describe('English', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  // protects=the bottom panel's warnings badge; fails_when=the status bar and the Warnings tab disagree on the number of warnings, or a warning is not listed in the panel; no_claim=the wording of each warning (unit tests)
  test('the warnings badge counts what the Warnings tab lists', async ({ page }) => {
    await openDemo(page);
    await page
      .getByRole('toolbar', { name: 'Panels' })
      .getByRole('button', { name: 'Warnings' })
      .click();
    const count = Number(await page.getByTestId('status-warnings-count').textContent());
    await expect(page.getByRole('tab', { name: /^Warnings/ })).toContainText(String(count));
    await expect(page.getByTestId('warnings-badge')).toHaveText(String(count));
    if (count > 0)
      await expect(page.getByTestId('warnings').getByRole('row')).toHaveCount(count + 1);
  });

  // protects=catalog search and price edit; fails_when=searching by code or name leaves other items, a price typed in the detail pane is lost on reload of the page state or does not reach the table; no_claim=imports and removal (unit tests)
  test('search the catalog and edit a price', async ({ page }) => {
    await start(page);
    await page.getByRole('button', { name: 'Settings' }).click();
    await page.getByRole('link', { name: 'Catalog', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Catalog' })).toBeVisible();
    const rows = page.getByRole('table').getByRole('row');
    const all = await rows.count();
    expect(all).toBeGreaterThan(5);

    const search = page.getByRole('textbox', { name: 'Search by name or code' });
    await search.fill('socket');
    await expect.poll(() => rows.count()).toBeLessThan(all);
    const filtered = await rows.count();
    expect(filtered).toBeGreaterThan(1);
    await search.fill('zzz no such item');
    await expect(page.getByText('No items match.')).toBeVisible();
    await search.fill('socket');
    await expect.poll(() => rows.count()).toBe(filtered);

    await rows.nth(1).click();
    const price = page.getByRole('textbox', { name: /^Price of / });
    await price.fill('12.50');
    await price.press('Enter');
    await expect(rows.nth(1)).toContainText('12.50');
  });

  // protects=dark theme on every route and the live canvas switch; fails_when=a route keeps a light page background under a dark colour scheme, or the plan canvas keeps its light colours after the scheme changes; no_claim=the stored preference (desktop E2E)
  test('every route is dark under a dark colour scheme and the canvas follows live', async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await openDemo(page);
    for (const path of routes) {
      await go(page, path);
      const luminance = await page.evaluate(() => {
        const [r = 255, g = 255, b = 255] = getComputedStyle(document.body)
          .backgroundColor.match(/\d+/g)!
          .map(Number);
        return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      });
      expect(luminance, `${path} background`).toBeLessThan(0.2);
    }

    await go(page, '/project/plan');
    const canvasPixels = () =>
      page.evaluate(() =>
        [...document.querySelectorAll('[data-testid="plan-canvas"] canvas')]
          .map((c) => (c as HTMLCanvasElement).toDataURL())
          .join('|'),
      );
    const area = page.getByTestId('canvas-area');
    await expect(area).toHaveCSS('background-color', rgb('#111214'));
    const dark = await canvasPixels();
    await page.emulateMedia({ colorScheme: 'light' });
    await expect(area).toHaveCSS('background-color', rgb('#ffffff'));
    await expect.poll(canvasPixels).not.toBe(dark);
  });

  // protects=the canvas gets most of the window; fails_when=the plan canvas is under 70% of a 1440x900 window with the bottom panel closed; no_claim=pixel exactness
  test('the canvas takes at least 70% of the window', async ({ page }) => {
    await openDemo(page);
    const box = (await page.getByTestId('canvas-area').boundingBox())!;
    expect((box.width * box.height) / (1440 * 900)).toBeGreaterThanOrEqual(0.7);
    expect(await editorState(page, (s) => s.ui.drawerOpen)).toBe(false);
  });
});

for (const [name, locale] of [
  ['English', 'en-US'],
  ['Italian', 'it-IT'],
] as const) {
  test.describe(`${name} layout`, () => {
    test.use({ locale, viewport: { width: 1280, height: 800 } });

    // protects=no horizontal overflow at the smallest supported desktop size; fails_when=a route is wider than a 1280x800 window in this language; no_claim=vertical scrolling
    test(`no route overflows horizontally in ${name}`, async ({ page }) => {
      await openDemo(page, locale === 'it-IT' ? 'Apri file…' : 'Open file…');
      for (const path of routes) {
        await go(page, path);
        const overflow = await page.evaluate(() => ({
          page: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          body: document.body.scrollWidth - document.body.clientWidth,
        }));
        expect(overflow, path).toEqual({ page: 0, body: 0 });
      }
    });
  });
}

for (const width of [1024, 1280, 1440]) {
  test.describe(`catalog toolbar at ${width}px`, () => {
    test.use({ locale: 'it-IT', viewport: { width, height: 700 } });

    // protects=the category chips fit the catalog toolbar without a scrollbar in Italian; fails_when=the chips (or a wrapper around them) scroll horizontally or reach past the toolbar; no_claim=other languages or the look of the wrapped chips
    test('the category chips show no horizontal scrollbar in Italian', async ({ page }) => {
      await openDemo(page, 'Apri file…');
      await go(page, '/settings/catalog');
      const chips = page.getByRole('radiogroup', { name: 'Categoria' });
      await expect(chips).toBeVisible();
      const fit = await chips.evaluate((el) => {
        const toolbar = el.parentElement!;
        const scrolls = (node: Element) => node.scrollWidth - node.clientWidth;
        const right = el.getBoundingClientRect().right;
        const toolbarRight = toolbar.getBoundingClientRect().right;
        const overflowing: string[] = [];
        for (
          let node: Element | null = el;
          node && node !== toolbar.parentElement;
          node = node.parentElement
        ) {
          if (scrolls(node) > 0) overflowing.push(node.tagName);
        }
        return { overflowing, past: right - toolbarRight };
      });
      expect(fit.overflowing).toEqual([]);
      expect(fit.past).toBeLessThanOrEqual(0);
    });
  });
}

test.describe('catalog at the minimum window width', () => {
  test.use({ locale: 'it-IT', viewport: { width: 1024, height: 700 } });

  // protects=the price column of the catalog table is visible without scrolling at 1024px; fails_when=the table scroller overflows horizontally next to the detail panel; no_claim=other widths or the table body scroll
  test('the catalog table fits next to the detail panel at 1024px', async ({ page }) => {
    await openDemo(page, 'Apri file…');
    await go(page, '/settings/catalog');
    const overflow = await page.evaluate(() => {
      const table = document.querySelector('main table')!;
      const scroller = table.parentElement!;
      return scroller.scrollWidth - scroller.clientWidth;
    });
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`keyboard focus in ${scheme}`, () => {
    test.use({ colorScheme: scheme, viewport: { width: 1280, height: 800 } });

    // protects=a visible focus ring on every route; fails_when=Tab reaches an element with no 2px focus-coloured outline, or never leaves the first element; no_claim=the order of the focus
    test(`Tab shows the focus ring on every route in the ${scheme} theme`, async ({ page }) => {
      await openDemo(page);
      for (const path of routes) {
        await go(page, path);
        await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
        const seen = new Set<string>();
        for (let i = 0; i < 12; i++) {
          await page.keyboard.press('Tab');
          const ring = await page.evaluate(() => {
            const el = document.activeElement as HTMLElement;
            if (!el || el === document.body) return null;
            const style = getComputedStyle(el);
            const token = getComputedStyle(document.documentElement)
              .getPropertyValue('--color-focus')
              .trim();
            return {
              id: `${el.tagName}:${el.getAttribute('aria-label') ?? el.textContent?.slice(0, 20)}`,
              visible: el.matches(':focus-visible'),
              width: style.outlineWidth,
              style: style.outlineStyle,
              color: style.outlineColor,
              token,
            };
          });
          if (!ring) continue;
          seen.add(ring.id);
          expect(ring.visible, `${path} ${ring.id}`).toBe(true);
          expect(ring.style, `${path} ${ring.id}`).not.toBe('none');
          expect(ring.width, `${path} ${ring.id}`).toBe('2px');
          // Buttons fade the outline colour in over 80 ms: wait for it to settle on the token.
          await expect
            .poll(
              () => page.evaluate(() => getComputedStyle(document.activeElement!).outlineColor),
              { message: `${path} ${ring.id}` },
            )
            .toBe(rgb(ring.token));
        }
        expect(seen.size, path).toBeGreaterThan(3);
      }
    });
  });
}
