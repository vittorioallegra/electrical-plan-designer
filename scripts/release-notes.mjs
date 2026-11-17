// Draft release notes in the layout of the published releases (v0.1.0): a summary to write by
// hand, what's new and fixed (from the Conventional Commits since the previous tag), the
// downloads, the first launch of the unsigned app and how to update. The project has no pull
// requests, so GitHub's generated notes would hold only a compare link.
// Run (CI, release job): node scripts/release-notes.mjs <tag> > notes.md
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const sections = [
  ['feat', "What's new"],
  ['fix', 'Fixes'],
];

/** The `- ` bullets of a commit body, each joined with its indented continuation lines. */
function bodyBullets(body = '') {
  const bullets = [];
  for (const line of body.split('\n')) {
    if (line.startsWith('- ')) bullets.push(line.slice(2).trim());
    else if (/^\s+\S/.test(line) && bullets.length > 0)
      bullets[bullets.length - 1] += ` ${line.trim()}`;
  }
  return bullets;
}

/** The parts after the changes, the same in every release: downloads, first launch, updates. */
function fixedParts(version) {
  return [
    '## Downloads',
    '',
    '| System | File |',
    '|---|---|',
    `| macOS, Apple Silicon (M1 and later) | \`Electrical.Plan.Designer-${version}-arm64.dmg\` |`,
    `| macOS, Intel | \`Electrical.Plan.Designer-${version}-x64.dmg\` |`,
    `| Windows 10/11, 64-bit | \`Electrical.Plan.Designer-${version}-Setup.exe\` |`,
    '',
    '## First launch (unsigned app)',
    '',
    'The app is not code-signed yet, so the system asks once before opening it.',
    '',
    '- **macOS**: drag the app from the `.dmg` to Applications and open it. When macOS refuses, open System Settings → Privacy & Security and choose **Open Anyway**. If it says the app is damaged, run `xattr -dr com.apple.quarantine "/Applications/Electrical Plan Designer.app"`.',
    '- **Windows**: run the installer. When SmartScreen shows "Windows protected your PC", choose **More info** → **Run anyway**.',
    '',
    'There are no automatic updates: to update, install a new version over the old one. Projects and the library are kept.',
  ];
}

/**
 * Markdown notes from commits (newest first, `{ subject, body }`) for `tag` (`v1.2.3`): a summary
 * placeholder, features then fixes (each with its body's bullets nested), then the fixed parts.
 * Other types (chore, docs, test, refactor) are left out; a breaking change (`!`) is marked.
 */
export function releaseNotes(commits, { tag }) {
  const lines = [
    '<!-- Summary: one paragraph on what this version brings; write it before publishing. -->',
    '',
  ];
  for (const [type, title] of sections) {
    const entries = commits.flatMap(({ subject, body }) => {
      const match = /^(\w+)(\([^)]*\))?(!)?:\s*(.+)$/.exec(subject);
      if (!match || match[1] !== type) return [];
      const text = match[4].charAt(0).toUpperCase() + match[4].slice(1);
      return [
        `- ${match[3] ? '**Breaking:** ' : ''}${text}`,
        ...bodyBullets(body).map((b) => `  - ${b}`),
      ];
    });
    if (entries.length > 0) lines.push(`## ${title}`, '', ...entries, '');
  }
  lines.push(...fixedParts(tag.replace(/^v/, '')));
  return lines.join('\n') + '\n';
}

function git(...args) {
  return execFileSync('git', args, { encoding: 'utf8' });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const tag = process.argv[2];
  if (!tag) throw new Error('usage: node scripts/release-notes.mjs <tag>');
  let previousTag = '';
  try {
    previousTag = git('describe', '--tags', '--abbrev=0', `${tag}^`).trim();
  } catch {
    // The first release: every commit up to the tag.
  }
  const range = previousTag ? `${previousTag}..${tag}` : tag;
  // Subject and body of each commit, separated by unit and record separators.
  const commits = git('log', '--format=%s%x1f%b%x1e', range)
    .split('\x1e')
    .map((record) => record.trim())
    .filter(Boolean)
    .map((record) => {
      const [subject, body] = record.split('\x1f');
      return { subject, body };
    });
  process.stdout.write(releaseNotes(commits, { tag }));
}
