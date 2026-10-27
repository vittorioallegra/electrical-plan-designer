import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderApp } from '@/testing/renderApp';
import { pickOption } from '@/testing/select';

async function openDemo() {
  const app = await renderApp('/project/plan', { exposeTestHandle: true });
  await screen.findByTestId('project-name');
  return app;
}

const requestClose = (windowHost: { requestClose(): void }) => act(() => windowHost.requestClose());

describe('window sync', () => {
  // protects=title state; fails_when=the window is not told the project name, the unsaved state after an edit and after a save, or that no project is open; no_claim=how main shows it (title, dot)
  it('reports the project name and whether it has unsaved changes', async () => {
    const { windowHost, workspace } = await openDemo();
    expect(windowHost.state).toEqual({ name: 'Demo house', unsaved: false });
    await userEvent.click(screen.getByRole('button', { name: 'Add floor' }));
    expect(windowHost.state).toEqual({ name: 'Demo house', unsaved: true });
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(windowHost.state?.unsaved).toBe(false));
    await userEvent.click(screen.getByRole('button', { name: 'Add floor' }));
    expect(windowHost.state?.unsaved).toBe(true);
    act(() => workspace.getState().close());
    await waitFor(() => expect(windowHost.state).toEqual({ name: null, unsaved: false }));
  });

  // protects=AC 8 close and quit prompt; fails_when=a close request with unsaved changes closes without asking, Cancel closes, Don't save keeps the window, or Save closes without writing the file; no_claim=the real window and quit (Electron E2E)
  it('asks Save / Don’t save / Cancel and answers main', async () => {
    const { windowHost, fileAccess } = await openDemo();
    await userEvent.click(screen.getByRole('button', { name: 'Add floor' }));

    requestClose(windowHost);
    expect(await screen.findByText('Save changes to “Demo house”?')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(windowHost.answers).toEqual(['cancel']);

    requestClose(windowHost);
    await userEvent.click(await screen.findByRole('button', { name: 'Don’t save' }));
    expect(windowHost.answers).toEqual(['cancel', 'close']);
    expect(fileAccess.writes).toEqual([]);

    requestClose(windowHost);
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(
      Array.from(dialog.querySelectorAll('button')).find((b) => b.textContent === 'Save')!,
    );
    await waitFor(() => expect(windowHost.answers).toEqual(['cancel', 'close', 'close']));
    expect(fileAccess.writes).toEqual(['Demo-house.epd']);
  });

  // protects=AC 9 recovery cleared on close; fails_when=Don't save or a successful Save from the close question leaves the recovery copy, so the next start offers a project that is already settled; no_claim=a kill (Electron E2E)
  it('clears the recovery copy on Don’t save and on Save', async () => {
    const { windowHost, recovery } = await openDemo();
    const edit = () => userEvent.click(screen.getByRole('button', { name: 'Add floor' }));
    const copied = () => waitFor(() => expect(recovery.copy).not.toBeNull(), { timeout: 3000 });
    const answerWith = async (name: string) => {
      requestClose(windowHost);
      const dialog = await screen.findByRole('dialog');
      await userEvent.click(
        Array.from(dialog.querySelectorAll('button')).find((b) => b.textContent === name)!,
      );
    };

    await edit();
    await copied();
    await answerWith('Don’t save');
    await waitFor(() => expect(windowHost.answers).toEqual(['close']));
    expect(recovery.copy).toBeNull();

    // The project is still open here (the fake window never closes): edit and save instead.
    await edit();
    await answerWith('Save');
    await waitFor(() => expect(windowHost.answers).toEqual(['close', 'close']));
    expect(recovery.copy).toBeNull();
  });

  // protects=Save from the close question; fails_when=a cancelled Save As closes the window anyway; no_claim=Save error dialogs (save tests)
  it('keeps the window open when the save from the close question is cancelled', async () => {
    const { windowHost, fileAccess } = await openDemo();
    await userEvent.click(screen.getByRole('button', { name: 'Add floor' }));
    requestClose(windowHost);
    const dialog = await screen.findByRole('dialog');
    fileAccess.nextSaveAs = null;
    await userEvent.click(
      Array.from(dialog.querySelectorAll('button')).find((b) => b.textContent === 'Save')!,
    );
    await waitFor(() => expect(windowHost.answers).toEqual(['cancel']));
    expect(fileAccess.writes).toEqual([]);
  });

  // protects=no question when nothing is at risk; fails_when=a project saved to its file, or no project, still asks; no_claim=—
  it('closes without asking when there is nothing unsaved', async () => {
    const { windowHost } = await openDemo();
    requestClose(windowHost);
    expect(windowHost.answers).toEqual(['close']);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  // protects=AC 6 Save, Save As, Undo and Redo from the native menu; fails_when=a menu command does not run the in-app action (Save writes elsewhere, Save As does not ask for a path, Undo/Redo do not move through history); no_claim=text fields' own undo (the browser)
  it('runs Save, Save As, Undo and Redo from the menu', async () => {
    const { windowHost, fileAccess, workspace } = await openDemo();
    const floors = () => workspace.getState().current!.store.getState().data.doc.floors.length;
    const before = floors();
    await userEvent.click(screen.getByRole('button', { name: 'Add floor' }));
    act(() => windowHost.menuCommand({ command: 'undo' }));
    expect(floors()).toBe(before);
    act(() => windowHost.menuCommand({ command: 'redo' }));
    expect(floors()).toBe(before + 1);

    act(() => windowHost.menuCommand({ command: 'save' }));
    await waitFor(() => expect(fileAccess.writes).toEqual(['Demo-house.epd']));
    fileAccess.nextSaveAs = 'copy.epd';
    act(() => windowHost.menuCommand({ command: 'saveAs' }));
    await waitFor(() => expect(fileAccess.writes).toEqual(['Demo-house.epd', 'copy.epd']));
  });

  // protects=AC 6 menu labels in the app's language; fails_when=the native menu gets no labels, labels in the wrong language, or is not updated when the language changes; no_claim=how main builds the menu (menu.test)
  it('gives the menu its labels and updates them with the language', async () => {
    const { windowHost } = await openDemo();
    expect(windowHost.menuLabels).toMatchObject({ file: 'File', saveAs: 'Save As…' });
    await pickOption(screen.getByRole('combobox', { name: 'Language' }), 'Italiano');
    await waitFor(() => expect(windowHost.menuLabels).toMatchObject({ saveAs: 'Salva con nome…' }));
  });
});
