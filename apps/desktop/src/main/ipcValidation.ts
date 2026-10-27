// Validation of everything the renderer sends to main. Pure functions, tested in plain Node.
import { isAbsolute } from 'node:path';
import { menuLabelKeys, themePreferences } from '@epd/bridge/bridge';
import type {
  CloseChoice,
  ExportFilter,
  FileStat,
  LibraryLogo,
  LibraryReplacement,
  MenuLabels,
  RecoveryMeta,
  RecoverySaveArgs,
  ThemePreference,
  WindowState,
} from '@epd/bridge/bridge';

export class InvalidArgument extends Error {
  override name = 'InvalidArgument';
}

/** Larger than any project file: a bound against a runaway renderer, not a feature limit. */
export const MAX_BYTES = 1024 * 1024 * 1024;

function fail(what: string): never {
  throw new InvalidArgument(`invalid ${what}`);
}

/** `scheme://host`; Node's `URL.origin` is "null" for custom schemes such as `app://`. */
export function originOf(url: string): string {
  const { protocol, host } = new URL(url);
  return `${protocol}//${host}`;
}

export function isAllowedUrl(url: string, origin: string): boolean {
  try {
    return originOf(url) === origin;
  } catch {
    return false;
  }
}

function text(value: unknown, what: string, max = 1024): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > max || value.includes('\0'))
    fail(what);
  return value;
}

function bytesOf(value: unknown): Uint8Array {
  if (!(value instanceof Uint8Array) || value.byteLength > MAX_BYTES) fail('bytes');
  return value;
}

function statOf(value: unknown): FileStat {
  const stat = value as Partial<FileStat> | null;
  if (
    typeof stat !== 'object' ||
    stat === null ||
    typeof stat.mtimeMs !== 'number' ||
    typeof stat.size !== 'number' ||
    !Number.isFinite(stat.mtimeMs) ||
    !Number.isFinite(stat.size)
  )
    fail('stat');
  return { mtimeMs: stat.mtimeMs, size: stat.size };
}

/** A file name proposed to the save dialog: no folders, no control characters. */
export function fileNameOf(value: unknown): string {
  const name = text(value, 'file name', 255);
  // eslint-disable-next-line no-control-regex
  if (/[\\/\u0000-\u001f]/.test(name) || name === '.' || name === '..') fail('file name');
  return name;
}

export function parseSaveArgs(args: unknown[]): {
  path: string;
  bytes: Uint8Array;
  expected: FileStat | null;
} {
  const path = text(args[0], 'path', 4096);
  if (!isAbsolute(path)) fail('path');
  return {
    path,
    bytes: bytesOf(args[1]),
    expected: args[2] === null ? null : statOf(args[2]),
  };
}

export function parseSaveAsArgs(args: unknown[]): { suggestedName: string; bytes: Uint8Array } {
  return { suggestedName: fileNameOf(args[0]), bytes: bytesOf(args[1]) };
}

export function parseExportArgs(args: unknown[]): {
  name: string;
  bytes: Uint8Array;
  filters: ExportFilter[];
} {
  return { name: fileNameOf(args[0]), bytes: bytesOf(args[1]), filters: parseFilters(args[2]) };
}

/** The file types of a save or import dialog. */
export function parseFilters(filters: unknown): ExportFilter[] {
  if (!Array.isArray(filters) || filters.length > 8) fail('filters');
  return filters.map((f: unknown) => {
    const filter = f as Partial<ExportFilter> | null;
    if (typeof filter !== 'object' || filter === null || !Array.isArray(filter.extensions))
      fail('filter');
    const extensions = filter.extensions as unknown[];
    if (extensions.length === 0 || extensions.length > 8) fail('filter');
    return {
      name: text(filter.name, 'filter name', 64),
      extensions: extensions.map((e) => {
        if (typeof e !== 'string' || !/^[A-Za-z0-9]{1,8}$/.test(e)) fail('extension');
        return e;
      }),
    };
  });
}

export function parseWindowState(value: unknown): WindowState {
  const state = value as Partial<WindowState> | null;
  if (typeof state !== 'object' || state === null || typeof state.unsaved !== 'boolean')
    fail('window state');
  if (state.name !== null && (typeof state.name !== 'string' || state.name.length > 512))
    fail('window state');
  return { name: state.name ?? null, unsaved: state.unsaved };
}

export function parseCloseChoice(value: unknown): CloseChoice {
  if (value !== 'close' && value !== 'cancel') fail('close choice');
  return value;
}

const ASSET_ID = /^[A-Za-z0-9_-]{1,128}$/;
const MIME_TYPE = /^[a-z]+\/[a-z0-9.+-]{1,64}$/;

function assetId(value: unknown): string {
  if (typeof value !== 'string' || !ASSET_ID.test(value)) fail('asset id');
  return value;
}

function recoveryMeta(value: unknown): RecoveryMeta {
  const meta = value as Partial<RecoveryMeta> | null;
  if (
    typeof meta !== 'object' ||
    meta === null ||
    typeof meta.savedToFile !== 'boolean' ||
    !Array.isArray(meta.assets) ||
    meta.assets.length > 10_000
  )
    fail('recovery meta');
  let file: RecoveryMeta['file'] = null;
  if (meta.file !== null && meta.file !== undefined) {
    const f = meta.file as Partial<NonNullable<RecoveryMeta['file']>>;
    const path = text(f.path, 'path', 4096);
    if (!isAbsolute(path)) fail('path');
    file = { path, name: text(f.name, 'file name', 255), stat: statOf(f.stat) };
  }
  return {
    file,
    savedToFile: meta.savedToFile,
    savedAt: text(meta.savedAt, 'saved at', 64),
    assets: (meta.assets as unknown[]).map((a) => {
      const asset = a as { id?: unknown; mimeType?: unknown } | null;
      if (typeof asset !== 'object' || asset === null) fail('asset');
      const mimeType = text(asset.mimeType, 'mime type', 128);
      if (!MIME_TYPE.test(mimeType)) fail('mime type');
      return { id: assetId(asset.id), mimeType };
    }),
  };
}

export function parseRecoverySaveArgs(args: unknown[]): RecoverySaveArgs {
  const value = args[0] as Partial<RecoverySaveArgs> | null;
  if (typeof value !== 'object' || value === null || !Array.isArray(value.newAssets))
    fail('recovery copy');
  if (typeof value.project !== 'string' || value.project.length > MAX_BYTES) fail('project');
  const meta = recoveryMeta(value.meta);
  const known = new Set(meta.assets.map((a) => a.id));
  return {
    project: value.project,
    meta,
    newAssets: (value.newAssets as unknown[]).map((a) => {
      const asset = a as { id?: unknown; bytes?: unknown } | null;
      if (typeof asset !== 'object' || asset === null) fail('asset');
      const id = assetId(asset.id);
      // Bytes for an asset the copy does not list would only be pruned again.
      if (!known.has(id)) fail('asset id');
      return { id, bytes: bytesOf(asset.bytes) };
    }),
  };
}

/** A path the renderer asks main to open or forget (main still checks it was handed out). */
export function parsePathArg(args: unknown[]): string {
  const path = text(args[0], 'path', 4096);
  if (!isAbsolute(path)) fail('path');
  return path;
}

export function parseMenuLabels(value: unknown): MenuLabels {
  const labels = value as Record<string, unknown> | null;
  if (typeof labels !== 'object' || labels === null) fail('menu labels');
  const result = {} as Record<string, string>;
  for (const key of menuLabelKeys) result[key] = text(labels[key], `menu label ${key}`, 128);
  return result as MenuLabels;
}

/** A logo (or none): the library service checks its type, size and first bytes. */
export function parseLibraryLogo(value: unknown): LibraryLogo | null {
  if (value === null) return null;
  const logo = value as Partial<LibraryLogo> | null;
  if (typeof logo !== 'object' || logo === null || typeof logo.mimeType !== 'string') fail('logo');
  return { mimeType: logo.mimeType as LibraryLogo['mimeType'], bytes: bytesOf(logo.bytes) };
}

/** A whole library and its logo; the library service validates the library itself. */
export function parseLibraryReplacement(args: unknown[]): LibraryReplacement {
  const value = args[0] as Partial<LibraryReplacement> | null;
  if (
    typeof value !== 'object' ||
    value === null ||
    typeof value.library !== 'object' ||
    value.library === null
  )
    fail('library');
  return { library: value.library, logo: parseLibraryLogo(value.logo ?? null) };
}

/** The theme preference to store: one of the three known values. */
export function parseThemePreference(value: unknown): ThemePreference {
  if (!themePreferences.includes(value as ThemePreference)) fail('theme');
  return value as ThemePreference;
}
