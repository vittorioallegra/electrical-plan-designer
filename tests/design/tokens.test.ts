import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const css = read('apps/web/src/app/styles.css');
const design = read('DESIGN.md');

type Tokens = Record<string, string>;

/** `--color-name: #hex;` declarations inside the first `{...}` block that follows `opener`. */
function tokensIn(source: string, opener: string, nth = 0): Tokens {
  let at = -1;
  for (let i = 0; i <= nth; i++) at = source.indexOf(opener, at + 1);
  expect(at, `block ${opener} in styles.css`).toBeGreaterThanOrEqual(0);
  const open = source.indexOf('{', at);
  const close =
    source.indexOf('\n  }', open) > 0 && opener.startsWith(':root:not')
      ? source.indexOf('\n  }', open)
      : source.indexOf('\n}', open);
  const out: Tokens = {};
  for (const m of source.slice(open, close).matchAll(/--color-([a-z0-9-]+):\s*(#[0-9a-fA-F]{6});/g))
    out[m[1]!] = m[2]!.toLowerCase();
  return out;
}

const light = tokensIn(css, '@theme static');
const darkMedia = tokensIn(css, ":root:not([data-theme='light'])");
const darkAttr = tokensIn(css, ":root[data-theme='dark']");

const designColors: Tokens = {};
for (const m of design.split('---')[1]!.matchAll(/^ {2}([a-z-]+): "(#[0-9A-Fa-f]{6})"/gm))
  designColors[m[1]!] = m[2]!.toLowerCase();

function luminance(hex: string): number {
  const channel = (i: number) => {
    const c = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2);
}
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

const surfaces = ['chrome', 'panel', 'raised', 'hover', 'pressed'];
// [foreground, backgrounds, minimum ratio]
const pairs: [string, string[], number][] = [
  ['text', surfaces, 4.5],
  ['text-muted', surfaces, 4.5],
  ['text-faint', ['chrome', 'panel', 'raised'], 3],
  ['accent-text', ['accent-subtle', 'panel'], 4.5],
  ['on-accent', ['accent', 'accent-hover'], 4.5],
  ['accent', ['chrome', 'panel', 'raised'], 3],
  ['focus', ['chrome', 'panel', 'raised'], 3],
  ['error', ['chrome', 'panel', 'raised', 'error-subtle'], 4.5],
  ['warning', ['chrome', 'panel', 'raised', 'warning-subtle'], 4.5],
  ['success', ['chrome', 'panel', 'raised', 'success-subtle'], 4.5],
  ['canvas-node', ['canvas-bg'], 4.5],
  ['canvas-label', ['canvas-bg'], 4.5],
  ['canvas-wall', ['canvas-bg', 'canvas-wall-fill'], 3],
  ['canvas-run', ['canvas-bg'], 3],
  ['canvas-riser', ['canvas-bg'], 3],
  ['canvas-selection', ['canvas-bg'], 3],
  ['canvas-warning', ['canvas-bg'], 3],
  ['canvas-highlight', ['canvas-bg'], 3],
];

describe('design tokens', () => {
  // protects=DESIGN.md as the source of the palette; fails_when=a color in DESIGN.md front matter differs from, or is missing in, styles.css (light or dark); no_claim=non-color tokens
  it('matches the DESIGN.md front-matter colors', () => {
    const expectedLight = Object.fromEntries(
      Object.entries(designColors).filter(([k]) => !k.startsWith('dark-')),
    );
    const expectedDark = Object.fromEntries(
      Object.entries(designColors)
        .filter(([k]) => k.startsWith('dark-'))
        .map(([k, v]) => [k.slice(5), v]),
    );
    expect(Object.keys(expectedLight).length).toBeGreaterThan(30);
    for (const [name, value] of Object.entries(expectedLight))
      expect(light[name], name).toBe(value);
    expect(darkMedia).toEqual(expectedDark);
    expect(darkAttr).toEqual(expectedDark);
  });

  for (const [theme, tokens] of [
    ['light', () => light],
    ['dark', () => ({ ...light, ...darkMedia })],
  ] as const) {
    // protects=readable text and indicators in both themes; fails_when=a text/surface or indicator/surface pair drops below 4.5:1 (3:1 for faint text, accents, focus and canvas strokes); no_claim=hover/pressed combinations of the accent
    it(`meets contrast on every text and surface pair (${theme})`, () => {
      const t = tokens();
      const failing: string[] = [];
      for (const [fg, bgs, min] of pairs)
        for (const bg of bgs) {
          expect(t[fg], fg).toBeDefined();
          expect(t[bg], bg).toBeDefined();
          const ratio = contrast(t[fg]!, t[bg]!);
          if (ratio < min) failing.push(`${fg} on ${bg}`);
        }
      expect(failing).toEqual([]);
    });
  }
});
