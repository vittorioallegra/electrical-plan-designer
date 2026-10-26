import { act, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { EditorStore } from '@/stores/editor/editorStore';
import { renderApp } from '@/testing/renderApp';

const editorStore = () => (window as unknown as { __epd: { store: EditorStore } }).__epd.store;

describe('open project across pages', () => {
  // protects=one open project per window; fails_when=leaving the editor for the start screen and coming back loses the edits or reopens the project; no_claim=reload (start screen restore)
  it('keeps the open project when leaving and re-entering the editor', async () => {
    const { router, recovery } = await renderApp('/project/plan', { exposeTestHandle: true });
    await screen.findByTestId('project-name');
    const store = editorStore();
    act(() =>
      store.getState().applyCommand('rename', (d) => {
        d.doc.nodes[0]!.label = 'first edit';
      }),
    );
    await act(() => router.navigate('/'));
    await screen.findByRole('region', { name: 'Open project' });
    await act(() => router.navigate('/project/plan'));
    await screen.findByTestId('project-name');
    expect(editorStore()).toBe(store);
    expect(store.getState().data.doc.nodes[0]!.label).toBe('first edit');
    await waitFor(
      async () => expect((await recovery.get())?.project.doc.nodes[0]!.label).toBe('first edit'),
      { timeout: 3000 },
    );
  });
});
