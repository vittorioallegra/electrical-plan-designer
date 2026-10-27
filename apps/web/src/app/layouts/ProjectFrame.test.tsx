import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { EditorStore } from '@/stores/editor/editorStore';
import { renderApp } from '@/testing/renderApp';

const store = () => (window as unknown as { __epd: { store: EditorStore } }).__epd.store;

async function openFrame() {
  await renderApp('/project/plan', { exposeTestHandle: true });
  await screen.findByTestId('project-name');
}

describe('project frame', () => {
  // protects=one navigation per context and no duplicated commands in the title bar; fails_when=a second navigation landmark appears, or Save, Undo, Redo or Home buttons come back (the native menu and shortcuts own them); no_claim=the native menu
  it('has one navigation landmark and no Save, Undo, Redo or Home buttons', async () => {
    await openFrame();
    const nav = screen.getAllByRole('navigation');
    expect(nav).toHaveLength(1);
    const views = within(nav[0]!).getAllByRole('link');
    expect(views.map((l) => l.textContent)).toEqual(['Plan', 'Panel', 'Quote', 'Project']);
    expect(within(nav[0]!).getByRole('link', { name: 'Plan' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    for (const name of ['Save', 'Undo', 'Redo', 'Start']) {
      expect(screen.queryByRole('button', { name })).toBeNull();
      expect(screen.queryByRole('link', { name })).toBeNull();
    }
    expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument();
  });

  // protects=Update from catalog and Close project in the project menu; fails_when=either action is missing from the menu or Close project does not leave the project; no_claim=the unsaved-changes question (start tests)
  it('keeps Update from catalog and Close project in the project menu', async () => {
    await openFrame();
    await userEvent.click(screen.getByRole('button', { name: 'Project menu' }));
    const menu = within(await screen.findByRole('menu'));
    expect(menu.getByRole('menuitem', { name: 'Update from catalog' })).toBeInTheDocument();
    await userEvent.click(menu.getByRole('menuitem', { name: 'Close project' }));
    expect(await screen.findByRole('heading', { name: 'Start' })).toBeInTheDocument();
  });

  // protects=bottom panel closed by default, opened and closed from the status bar and its own button, state outside the project data; fails_when=the panel starts open, a status button does not toggle it, or opening it marks the project changed; no_claim=panel animation and drag resize (browser E2E)
  it('opens and closes the bottom panel from the status bar', async () => {
    await openFrame();
    const bar = screen.getByRole('toolbar', { name: 'Panels' });
    const warnings = within(bar).getByRole('button', { name: /^Warnings/ });
    expect(store().getState().ui.drawerOpen).toBe(false);
    expect(warnings).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByRole('tab', { name: 'BOM' })).toBeNull();
    // The count is always visible, even at zero.
    expect(within(warnings).getByTestId('status-warnings-count')).toBeInTheDocument();

    const revision = store().getState().revision;
    await userEvent.click(within(bar).getByRole('button', { name: /^BOM/ }));
    expect(store().getState().ui).toMatchObject({ drawerOpen: true, drawerTab: 'bom' });
    expect(await screen.findByRole('tab', { name: 'BOM', selected: true })).toBeInTheDocument();

    await userEvent.click(within(bar).getByRole('button', { name: /^Warnings/ }));
    expect(store().getState().ui).toMatchObject({ drawerOpen: true, drawerTab: 'warnings' });

    await userEvent.click(within(bar).getByRole('button', { name: /^Warnings/ }));
    expect(store().getState().ui.drawerOpen).toBe(false);
    expect(screen.queryByRole('tab', { name: 'BOM' })).toBeNull();

    await userEvent.click(within(bar).getByRole('button', { name: /^Circuits/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Close panel' }));
    expect(store().getState().ui.drawerOpen).toBe(false);
    expect(store().getState().revision).toBe(revision);
  });
});
