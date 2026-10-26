import { describe, expect, it } from 'vitest';
import { ProjectFileError } from './errors';
import {
  migrateProjectFile,
  PROJECT_FILE_SCHEMA_VERSION,
  projectFileMigrations,
} from './migrations';

function codeOf(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (e) {
    return e instanceof ProjectFileError ? e.code : 'other';
  }
  return undefined;
}

describe('project file migrations', () => {
  // protects=every version step has a migration; fails_when=the schema version is bumped without adding projectFileMigrations[n]; no_claim=what a migration does
  it('has one migration per version step', () => {
    for (let v = 1; v < PROJECT_FILE_SCHEMA_VERSION; v++) {
      expect(projectFileMigrations[v], `migration from ${v}`).toBeTypeOf('function');
    }
  });

  // protects=migrations run in order without touching the input; fails_when=a step is skipped, repeated or mutates the caller's object; no_claim=real migrations
  it('runs the steps in order on a copy', () => {
    const steps = {
      1: (p: Record<string, unknown>) => ({ ...p, log: [...(p.log as string[]), 'a'] }),
      2: (p: Record<string, unknown>) => {
        (p.log as string[]).push('b');
        return p;
      },
    };
    const input = { log: [] as string[] };
    expect(migrateProjectFile(input, 1, 3, steps)).toEqual({ log: ['a', 'b'] });
    expect(migrateProjectFile(input, 2, 3, steps)).toEqual({ log: ['b'] });
    expect(input.log).toEqual([]);
  });

  // protects=unknown versions fail clearly; fails_when=a gap, a bad version or a newer version does not throw its code; no_claim=message wording
  it('rejects versions it cannot migrate', () => {
    expect(codeOf(() => migrateProjectFile({}, 1, 3, { 2: (p) => p }))).toBe('unsupported_version');
    expect(codeOf(() => migrateProjectFile({}, 0, 1, {}))).toBe('unsupported_version');
    expect(codeOf(() => migrateProjectFile({}, 1.5, 2, {}))).toBe('unsupported_version');
    expect(codeOf(() => migrateProjectFile({}, 3, 2, {}))).toBe('newer_version');
    expect(migrateProjectFile({ a: 1 }, 2, 2, {})).toEqual({ a: 1 });
  });
});
