import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { Readable } from 'node:stream';
import { protocol } from 'electron';

export const APP_SCHEME = 'app';
export const APP_ORIGIN = `${APP_SCHEME}://epd`;

/** No network at runtime: everything comes from the app itself. WASM is needed by pdf.js. */
export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "worker-src 'self' blob:",
  "connect-src 'self' data: blob:",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join('; ');

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.wasm': 'application/wasm',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

/** Must run before the app is ready. */
export function registerAppScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: APP_SCHEME,
      privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true },
    },
  ]);
}

/** Resolves a request path inside `root`, or null when it would leave it. */
export function resolveAppPath(root: string, pathname: string): string | null {
  const relative = normalize(decodeURIComponent(pathname)).replace(/^[/\\]+/, '');
  const file = join(root, relative);
  return file === root || file.startsWith(root + sep) ? file : null;
}

async function isFile(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

/**
 * Serves the built renderer from `root` on `app://epd/...`. A path with no file extension is a
 * client route (`/project/plan`), so it gets `index.html`; a missing asset is a real 404.
 */
export function serveRenderer(root: string): void {
  protocol.handle(APP_SCHEME, async (request) => {
    const { pathname } = new URL(request.url);
    let file = resolveAppPath(root, pathname);
    if (file === null) return new Response('Forbidden', { status: 403 });
    if (!(await isFile(file))) {
      if (extname(pathname) !== '') return new Response('Not found', { status: 404 });
      file = join(root, 'index.html');
    }
    // Read the file directly: `net.fetch` of a file: URL would pass through the request filter.
    return new Response(Readable.toWeb(createReadStream(file)) as ReadableStream, {
      headers: {
        'Content-Type': MIME_TYPES[extname(file)] ?? 'application/octet-stream',
        'Content-Security-Policy': CONTENT_SECURITY_POLICY,
      },
    });
  });
}
