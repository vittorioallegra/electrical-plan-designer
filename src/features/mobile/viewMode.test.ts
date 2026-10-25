import { afterEach, describe, expect, it } from 'vitest';
import { mobilePathFor, resolveViewMode, setViewMode } from './viewMode';

afterEach(() => sessionStorage.clear());

describe('view mode', () => {
  // protects=viewport mode resolved once per session; fails_when=a later resize flips the mode or the manual switch is ignored; no_claim=—
  it('decides from the first width and keeps it for the session', () => {
    expect(resolveViewMode(375)).toBe('mobile');
    expect(resolveViewMode(1400)).toBe('mobile');
    setViewMode('desktop');
    expect(resolveViewMode(375)).toBe('desktop');
  });

  // protects=mobile redirects; fails_when=a desktop project link has no mobile page or other pages are redirected; no_claim=—
  it('maps project pages to the mobile view', () => {
    expect(mobilePathFor('/projects')).toBe('/m/projects');
    expect(mobilePathFor('/projects/abc/panel')).toBe('/m/projects/abc');
    expect(mobilePathFor('/catalog')).toBeNull();
  });
});
