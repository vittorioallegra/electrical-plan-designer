import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { EditorStore } from '@/stores/editor/editorStore';
import { renderApp } from '@/testing/renderApp';

const store = () =>
  (window as unknown as { __epd?: { store: EditorStore } }).__epd!.store.getState();

async function openBox(nodeId: string) {
  await renderApp('/project/plan', { exposeTestHandle: true });
  await screen.findByTestId('project-name');
  act(() => store().setUi({ selection: [nodeId] }));
  return screen.findByTestId('column-section');
}

const column = (stackId: string | undefined) =>
  store().data.doc.nodes.filter((n) => stackId !== undefined && n.stackId === stackId);

describe('inspector column section', () => {
  // protects=adding boxes to a column from the inspector; fails_when=Add box above/below does not create a box in the selected box's column at 0.20 m from it, or the list is not top to bottom; no_claim=canvas drawing
  it('adds boxes above and below and lists the column top to bottom', async () => {
    // n_s1: socket box at 0.30 m.
    const section = await openBox('n_s1');
    expect(within(section).getByText(/only box at this point/)).toBeInTheDocument();
    await userEvent.click(within(section).getByRole('button', { name: 'Add box above' }));
    const stackId = store().data.doc.nodes.find((n) => n.id === 'n_s1')!.stackId;
    expect(column(stackId)).toHaveLength(2);
    const above = column(stackId).find((n) => n.id !== 'n_s1')!;
    expect(above.customHeight).toBeCloseTo(0.5);
    expect(store().ui.selection).toEqual([above.id]);

    // The new box is selected: add one below it (0.30 m, the socket box's height).
    const again = await screen.findByTestId('column-section');
    await userEvent.click(within(again).getByRole('button', { name: 'Add box below' }));
    expect(column(stackId)).toHaveLength(3);
    const rows = within(await screen.findByTestId('column-section'))
      .getAllByRole('button')
      .filter((b) => /m$/.test(b.textContent ?? ''));
    expect(rows.map((r) => r.textContent)).toEqual([
      expect.stringContaining('0.50 m'),
      expect.stringContaining('0.30 m'),
      expect.stringContaining('0.30 m'),
    ]);
    // The vertical conduits were derived: two for three boxes.
    const ids = new Set(column(stackId).map((n) => n.id));
    expect(
      store().data.doc.segments.filter((s) => ids.has(s.fromNodeId) && ids.has(s.toNodeId)),
    ).toHaveLength(2);
  });

  // protects=take out and undo; fails_when=Take out of column leaves the box in the column or at the same point, or undo does not restore the column in one step; no_claim=—
  it('takes a box out of its column, and undo puts it back', async () => {
    const section = await openBox('n_s1');
    await userEvent.click(within(section).getByRole('button', { name: 'Add box above' }));
    const stackId = store().data.doc.nodes.find((n) => n.id === 'n_s1')!.stackId;
    const added = store().ui.selection[0]!;
    await userEvent.click(
      within(await screen.findByTestId('column-section')).getByRole('button', {
        name: 'Take out of column',
      }),
    );
    const out = store().data.doc.nodes.find((n) => n.id === added)!;
    expect(out.stackId).toBeUndefined();
    expect(out.position).toEqual({ x: 5.3, y: 3 });
    expect(store().data.doc.nodes.find((n) => n.id === 'n_s1')!.stackId).toBeUndefined();
    act(() => store().undo());
    expect(column(stackId)).toHaveLength(2);
  });

  // protects=AC 5 move from the inspector; fails_when=editing X of a column box leaves the other boxes behind; no_claim=drag on the canvas
  it('moves the whole column when X changes', async () => {
    const section = await openBox('n_s1');
    await userEvent.click(within(section).getByRole('button', { name: 'Add box above' }));
    const stackId = store().data.doc.nodes.find((n) => n.id === 'n_s1')!.stackId;
    const x = screen.getByLabelText('Position X');
    await userEvent.clear(x);
    await userEvent.type(x, '6{Enter}');
    expect(column(stackId).map((n) => n.position.x)).toEqual([6, 6]);
  });
});
