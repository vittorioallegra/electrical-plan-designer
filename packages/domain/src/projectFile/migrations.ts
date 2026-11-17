// Migrations of project.json between file schema versions. Each one is a pure function and
// gets a test against a frozen fixture of the version it upgrades from (fixtures/v<n>.json).
import { ProjectFileError } from './errors';

export const PROJECT_FILE_SCHEMA_VERSION = 2;

export type ProjectFileMigration = (project: Record<string, unknown>) => Record<string, unknown>;

/** projectFileMigrations[n] upgrades project.json from schema version n to n + 1. */
export const projectFileMigrations: Readonly<Record<number, ProjectFileMigration>> = {
  // 1 → 2: catalog items gain the `smart_device` category. Nothing to change in a v1 file; the
  // bump only keeps older apps from opening a file that may hold the new category.
  1: (project) => project,
};

/** Runs the migrations from `fromVersion` up to `toVersion`; throws ProjectFileError. */
export function migrateProjectFile(
  project: Record<string, unknown>,
  fromVersion: number,
  toVersion: number = PROJECT_FILE_SCHEMA_VERSION,
  migrations: Readonly<Record<number, ProjectFileMigration>> = projectFileMigrations,
): Record<string, unknown> {
  if (!Number.isInteger(fromVersion) || fromVersion < 1) {
    throw new ProjectFileError('unsupported_version', [
      { path: 'schemaVersion', message: `unsupported schema version ${String(fromVersion)}` },
    ]);
  }
  if (fromVersion > toVersion) {
    throw new ProjectFileError('newer_version', [
      {
        path: 'schemaVersion',
        message: `schema version ${fromVersion} is newer than ${toVersion}`,
      },
    ]);
  }
  let current = project;
  for (let version = fromVersion; version < toVersion; version++) {
    const step = migrations[version];
    if (!step) {
      throw new ProjectFileError('unsupported_version', [
        { path: 'schemaVersion', message: `no migration from ${version}` },
      ]);
    }
    current = step(structuredClone(current));
  }
  return current;
}
