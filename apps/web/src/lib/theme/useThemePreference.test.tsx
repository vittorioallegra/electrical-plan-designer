import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { EpdBridge, ThemePreference } from '@epd/bridge/bridge';
import {
  createDesktopPreferencesRepository,
  createMemoryPreferencesRepository,
  themeStorageKey,
} from '@/lib/repositories/preferences';
import type { PreferencesRepository } from '@/lib/repositories/types';
import { EditorServicesProvider, type EditorServices } from '@/stores/editor/EditorContext';
import { useThemePreference } from './useThemePreference';

function wrapperFor(preferences: PreferencesRepository) {
  const services = { preferences } as unknown as EditorServices;
  return ({ children }: { children: ReactNode }) => (
    <EditorServicesProvider services={services}>{children}</EditorServicesProvider>
  );
}

/** Main's side of the bridge: stores the value and tells every subscribed window. */
function fakeBridge(initial: ThemePreference = 'system') {
  let stored = initial;
  const listeners = new Set<(theme: ThemePreference) => void>();
  const bridge: EpdBridge['preferences'] = {
    getTheme: async () => stored,
    setTheme: vi.fn(async (theme: ThemePreference) => {
      stored = theme;
      listeners.forEach((listener) => listener(theme));
    }),
    onThemeChanged(listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
  };
  return { bridge, announce: (theme: ThemePreference) => listeners.forEach((l) => l(theme)) };
}

describe('useThemePreference', () => {
  // protects=the desktop theme goes through the bridge and follows changes made elsewhere; fails_when=the stored value is not read, setTheme does not reach main, or another window's change is not shown; no_claim=data-theme (main drives nativeTheme)
  it('reads, sets and follows the theme over the bridge', async () => {
    document.documentElement.removeAttribute('data-theme');
    const { bridge, announce } = fakeBridge('dark');
    const { result } = renderHook(() => useThemePreference(), {
      wrapper: wrapperFor(createDesktopPreferencesRepository(bridge)),
    });
    expect(result.current.theme).toBe('system');
    await waitFor(() => expect(result.current.theme).toBe('dark'));

    act(() => result.current.setTheme('light'));
    expect(result.current.theme).toBe('light');
    expect(bridge.setTheme).toHaveBeenCalledWith('light');

    act(() => announce('system'));
    expect(result.current.theme).toBe('system');
    expect(document.documentElement.dataset.theme).toBeUndefined();
  });

  // protects=the browser fallback stores the theme and sets data-theme; fails_when=the choice is not kept in storage, data-theme is not set or removed, or a stored choice is ignored at start; no_claim=the canvas colours
  it('keeps the theme in storage and sets data-theme without the bridge', async () => {
    const root = document.createElement('div');
    const values = new Map<string, string>([[themeStorageKey, 'dark']]);
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => void values.set(key, value),
    };
    const repository = createMemoryPreferencesRepository({ storage, root });
    expect(root.dataset.theme).toBe('dark');

    const { result } = renderHook(() => useThemePreference(), { wrapper: wrapperFor(repository) });
    await waitFor(() => expect(result.current.theme).toBe('dark'));

    act(() => result.current.setTheme('light'));
    await waitFor(() => expect(root.dataset.theme).toBe('light'));
    expect(values.get(themeStorageKey)).toBe('light');

    act(() => result.current.setTheme('system'));
    await waitFor(() => expect(root.dataset.theme).toBeUndefined());
    expect(values.get(themeStorageKey)).toBe('system');
  });

  // protects=a stored value that is not a theme does not break the browser fallback; fails_when=garbage in storage is applied or throws; no_claim=blocked storage
  it('ignores an invalid stored theme', async () => {
    const root = document.createElement('div');
    const repository = createMemoryPreferencesRepository({
      storage: { getItem: () => 'purple', setItem: () => undefined },
      root,
    });
    expect(await repository.getTheme()).toBe('system');
    expect(root.dataset.theme).toBeUndefined();
  });
});
