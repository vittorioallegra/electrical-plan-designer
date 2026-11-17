import { describe, expect, it } from 'vitest';
// @ts-expect-error plain JS module without types
import { releaseNotes } from './release-notes.mjs';

const commits = [
  { subject: 'chore: bump version to 0.2.0', body: '' },
  {
    subject: 'feat: add Shelly smart devices',
    body: 'Why it matters.\n\n- Pro models on the rail;\n  never a circuit device.\n- In-box models',
  },
  { subject: 'fix(panel): keep the rail order', body: '' },
  { subject: 'docs: release steps', body: '- not listed' },
  { subject: 'feat!: drop the old file format', body: '' },
];

describe('release notes', () => {
  // protects=the draft follows the published releases' layout; fails_when=the summary placeholder, the changes, the downloads, the first launch or the update note are missing or out of order; no_claim=the wording of the summary (written by hand)
  it('lays the draft out like the published releases', () => {
    const notes: string = releaseNotes(commits, { tag: 'v0.2.0' });
    const headings = notes.split('\n').filter((l) => l.startsWith('## '));
    expect(headings).toEqual([
      "## What's new",
      '## Fixes',
      '## Downloads',
      '## First launch (unsigned app)',
    ]);
    expect(notes.startsWith('<!-- Summary:')).toBe(true);
    expect(notes).toContain('`Electrical.Plan.Designer-0.2.0-arm64.dmg`');
    expect(notes).toContain('`Electrical.Plan.Designer-0.2.0-Setup.exe`');
    expect(notes.trimEnd().endsWith('Projects and the library are kept.')).toBe(true);
  });

  // protects=the changes from the commits; fails_when=features and fixes are not listed under their headings, body bullets are not nested under their commit, chores, docs or tests leak in, or a breaking change is not marked; no_claim=git history reading (CI)
  it('lists features and fixes from the commits', () => {
    const notes: string = releaseNotes(commits, { tag: 'v0.2.0' });
    const changes = notes.slice(notes.indexOf("## What's new"), notes.indexOf('## Downloads'));
    expect(changes).toBe(
      [
        "## What's new",
        '',
        '- Add Shelly smart devices',
        '  - Pro models on the rail; never a circuit device.',
        '  - In-box models',
        '- **Breaking:** Drop the old file format',
        '',
        '## Fixes',
        '',
        '- Keep the rail order',
        '',
        '',
      ].join('\n'),
    );
  });

  // protects=a release with no feature or fix; fails_when=empty change sections are printed; no_claim=—
  it('leaves out empty change sections', () => {
    const notes: string = releaseNotes([{ subject: 'chore: bump', body: '' }], { tag: 'v0.2.1' });
    expect(notes).not.toContain("## What's new");
    expect(notes).not.toContain('## Fixes');
    expect(notes).toContain('## Downloads');
  });
});
