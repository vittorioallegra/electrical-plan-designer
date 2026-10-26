import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { readEpd } from '@/lib/projectFile/epd';
import type { EditorStore } from '@/stores/editor/editorStore';
import { renderApp } from '@/testing/renderApp';

const editorStore = () => (window as unknown as { __epd: { store: EditorStore } }).__epd.store;

async function openDemo() {
  const app = await renderApp('/project/plan', { exposeTestHandle: true });
  await screen.findByTestId('project-name');
  return app;
}

describe('save', () => {
  // protects=AC 1 save and reopen; fails_when=Save writes a file that does not read back as the open project, or the status does not become saved; no_claim=the File System Access API itself
  it('asks where to save a project without a file, then overwrites it on Ctrl+S', async () => {
    const { fileAccess } = await openDemo();
    const saveAs = vi.spyOn(fileAccess, 'saveAs');
    await userEvent.click(screen.getByRole('button', { name: 'Add floor' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.getByTestId('save-status')).toHaveTextContent('Saved'));
    expect(saveAs).toHaveBeenCalledWith(expect.any(Uint8Array), 'Demo-house.epd');
    expect(readEpd(fileAccess.files.get('Demo-house.epd')!).project).toEqual(
      editorStore().getState().data,
    );
    expect(await screen.findByText('Saved to Demo-house.epd')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Add floor' }));
    expect(screen.getByTestId('save-status')).not.toHaveTextContent('Saved');
    const save = vi.spyOn(fileAccess, 'save');
    fireEvent.keyDown(window, { key: 's', ctrlKey: true });
    await waitFor(() => expect(screen.getByTestId('save-status')).toHaveTextContent('Saved'));
    expect(save).toHaveBeenCalledWith(
      { name: 'Demo-house.epd', handle: 'Demo-house.epd' },
      expect.any(Uint8Array),
    );
    expect(saveAs).toHaveBeenCalledTimes(1);
    expect(readEpd(fileAccess.files.get('Demo-house.epd')!).project.doc.floors).toHaveLength(5);
  });

  // protects=failed or cancelled saves; fails_when=a failed write marks the project saved or shows nothing, or a cancelled Save as changes the file; no_claim=atomic replace on disk
  it('keeps the unsaved state when saving fails or is cancelled', async () => {
    const { fileAccess } = await openDemo();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await userEvent.click(screen.getByRole('button', { name: 'Add floor' }));
    fileAccess.nextSaveAs = null;
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(fileAccess.files.size).toBe(0);
    expect(editorStore().getState().file).toBeNull();

    fileAccess.failNextSave = true;
    await userEvent.click(screen.getByRole('button', { name: 'Save as…' }));
    expect(
      await screen.findByText(
        'Could not save the file. The file and the draft on this device are unchanged.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByTestId('save-status')).not.toHaveTextContent('Saved');
    // Still the revision the project was opened at, not the edited one.
    expect(editorStore().getState().fileRevision).toBe(0);
  });
});
