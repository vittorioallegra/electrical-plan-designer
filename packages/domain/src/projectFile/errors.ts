export type ProjectFileErrorCode =
  /** The manifest is missing or does not describe an `.epd` file. */
  | 'not_a_project'
  /** Written by a newer app version: refused, never opened read-only. */
  | 'newer_version'
  /** A schema version this app cannot migrate from. */
  | 'unsupported_version'
  /** The content does not match the schema. */
  | 'invalid';

export class ProjectFileError extends Error {
  override name = 'ProjectFileError';
  constructor(
    readonly code: ProjectFileErrorCode,
    readonly issues: { path: string; message: string }[] = [],
  ) {
    super(
      issues.length === 0
        ? code
        : `${code}: ${issues.map((i) => `${i.path || '(root)'} ${i.message}`).join('; ')}`,
    );
  }
}
