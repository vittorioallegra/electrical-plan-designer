import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = new URL('../..', import.meta.url).pathname;
const srcRoot = join(repoRoot, 'apps/web/src');
const literal = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|oklch|oklab|lab|lch)\(/;

/** Files allowed to hold a color literal, with the reason. Everything else reads a token. */
const allowed: Record<string, string> = {
  'apps/web/src/app/styles.css': 'the design tokens themselves',
  'apps/web/src/features/editor/background/importFile.ts':
    'white fill that flattens imported backgrounds into a PNG, not UI',
};
/** PDF modules draw with jsPDF numeric colors on paper; exports keep their own look. */
const pdfModule = /\/exports\/utils\/[^/]*Pdf[^/]*\.ts$/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const path = join(dir, e.name);
    if (e.isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx|css)$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) ? [path] : [];
  });
}

describe('color literals', () => {
  // protects=theming through tokens; fails_when=a hex/rgb/hsl literal appears in app source outside styles.css, the PDF modules or the allowlist; no_claim=named colors or numeric PDF colors
  it('keeps hex, rgb and hsl literals out of app source except the allowlist', () => {
    const offenders = sourceFiles(srcRoot)
      .map((f) => relative(repoRoot, f))
      .filter((f) => !(f in allowed) && !pdfModule.test(`/${f}`))
      .filter((f) => literal.test(readFileSync(join(repoRoot, f), 'utf8')));
    expect(offenders).toEqual([]);
  });

  // protects=an honest allowlist; fails_when=an allowlisted file no longer holds a literal; no_claim=PDF modules
  it('lists only files that still need their exception', () => {
    const stale = Object.keys(allowed).filter(
      (f) => !literal.test(readFileSync(join(repoRoot, f), 'utf8')),
    );
    expect(stale).toEqual([]);
  });
});
