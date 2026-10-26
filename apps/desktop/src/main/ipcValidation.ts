// Validation of everything the renderer sends to main. Pure functions, tested in plain Node.
import { isAbsolute } from 'node:path';
import type { CloseChoice, ExportFilter, FileStat, WindowState } from '@epd/bridge/bridge';

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
  const filters = args[2];
  if (!Array.isArray(filters) || filters.length > 8) fail('filters');
  return {
    name: fileNameOf(args[0]),
    bytes: bytesOf(args[1]),
    filters: filters.map((f: unknown) => {
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
    }),
  };
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
