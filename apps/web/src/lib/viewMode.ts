// Editor vs mobile light view: resolved once per browser session from the width, then only
// changed by the manual switch, so resizing never bounces routes.
export type ViewMode = 'mobile' | 'desktop';

const KEY = 'epd.viewMode';
export const MOBILE_MAX_WIDTH = 767;

export function resolveViewMode(width: number = window.innerWidth): ViewMode {
  try {
    const stored = sessionStorage.getItem(KEY);
    if (stored === 'mobile' || stored === 'desktop') return stored;
  } catch {
    // Storage unavailable: decide from the width every time.
  }
  const mode: ViewMode = width <= MOBILE_MAX_WIDTH ? 'mobile' : 'desktop';
  setViewMode(mode);
  return mode;
}

export function setViewMode(mode: ViewMode): void {
  try {
    sessionStorage.setItem(KEY, mode);
  } catch {
    // Not persisted: the next load decides from the width again.
  }
}

/** Mobile counterpart of a desktop path (project list and project pages), if any. */
export function mobilePathFor(pathname: string): string | null {
  if (pathname === '/projects' || pathname === '/') return '/m/projects';
  const project = /^\/projects\/([^/]+)/.exec(pathname);
  return project ? `/m/projects/${project[1]}` : null;
}
