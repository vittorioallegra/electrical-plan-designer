// Migrations of project.json between file schema versions. Each one is a pure function and
// gets a test against a frozen fixture of the version it upgrades from (fixtures/v<n>.json).
import { ProjectFileError } from './errors';

export const PROJECT_FILE_SCHEMA_VERSION = 1;

export type ProjectFileMigration = (project: Record<string, unknown>) => Record<string, unknown>;

/** projectFileMigrations[n] upgrades project.json from schema version n to n + 1. None yet. */
export const projectFileMigrations: Readonly<Record<number, ProjectFileMigration>> = {};

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
