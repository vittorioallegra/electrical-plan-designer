import { describe, expect, it } from 'vitest';
import { windowTitle } from './windowTitle';

describe('window title', () => {
  // protects=title with project name and unsaved marker; fails_when=Windows shows no * for unsaved changes, macOS shows one (it has the document-edited dot), or no project shows a name; no_claim=setDocumentEdited itself
  it('shows the project name and the unsaved marker per platform', () => {
    expect(windowTitle(null, false, 'win32')).toBe('Electrical Plan Designer');
    expect(windowTitle('House', false, 'win32')).toBe('House - Electrical Plan Designer');
    expect(windowTitle('House', true, 'win32')).toBe('*House - Electrical Plan Designer');
    expect(windowTitle('House', true, 'darwin')).toBe('House - Electrical Plan Designer');
  });
});
