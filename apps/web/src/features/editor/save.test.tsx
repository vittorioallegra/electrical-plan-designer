import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { APP_VERSION } from '@/config/version';
import { readEpd, writeEpd } from '@/lib/projectFile/epd';
import type { EditorStore } from '@/stores/editor/editorStore';
import { demoProjectFile } from '@/testing/editor';
import { renderApp } from '@/testing/renderApp';

const editorStore = () => (window as unknown as { __epd: { store: EditorStore } }).__epd.store;

/** The demo project opened from `house.epd`, so Save writes that file in place. */
async function openFromFile() {
  const app = await renderApp('/project/plan', { exposeTestHandle: true });
  await screen.findByTestId('project-name');
  const { fileAccess } = app;
  const original = writeEpd(demoProjectFile(), new Map(), {
    appVersion: APP_VERSION,
    now: new Date(),
  });
  fileAccess.files.set('house.epd', original);
  fileAccess.nextOpen = 'house.epd';
  const opened = (await fileAccess.open())!;
  editorStore().setState({ file: { path: opened.path, name: opened.name, stat: opened.stat } });
  return { ...app, original };
}

const addFloor = () => userEvent.click(screen.getByRole('button', { name: 'Add floor' }));
const clickSave = () => userEvent.click(screen.getByRole('button', { name: 'Save' }));
const status = () => screen.getByTestId('save-status');
const floorsIn = (bytes: Uint8Array) => readEpd(bytes).project.doc.floors.length;

describe('save', () => {
  // protects=AC 2 save in place; fails_when=Save (button or Ctrl+S) writes any file but the opened one, creates a second file, or does not hold the open project; no_claim=atomic writes and real disks (main-process tests, Electron E2E)
  it('writes the opened file in place on Save and on Ctrl+S', async () => {
    const { fileAccess } = await openFromFile();
    await addFloor();
    await clickSave();
    await waitFor(() => expect(status()).toHaveTextContent('Saved'));
    expect([...fileAccess.files.keys()]).toEqual(['house.epd']);
    expect(fileAccess.writes).toEqual(['house.epd']);
    expect(readEpd(fileAccess.files.get('house.epd')!).project).toEqual(
      editorStore().getState().data,
    );
    expect(await screen.findByText('Saved: house.epd')).toBeInTheDocument();

    await addFloor();
    expect(status()).not.toHaveTextContent('Saved');
    fireEvent.keyDown(window, { key: 's', ctrlKey: true });
    await waitFor(() => expect(status()).toHaveTextContent('Saved'));
    expect([...fileAccess.files.keys()]).toEqual(['house.epd']);
    expect(floorsIn(fileAccess.files.get('house.epd')!)).toBe(5);
  });

  // protects=a project with no file; fails_when=Save writes without asking where, ignores the chosen name for later saves, or a cancelled dialog marks the project saved; no_claim=the native dialog
  it('asks where to save a project with no file, then saves there', async () => {
    const { fileAccess } = await renderApp('/project/plan', { exposeTestHandle: true });
    await screen.findByTestId('project-name');
    await addFloor();

    fileAccess.nextSaveAs = null;
    await clickSave();
    await waitFor(() => expect(fileAccess.writes).toEqual([]));
    expect(status()).not.toHaveTextContent('Saved');

    await clickSave();
    await waitFor(() => expect(status()).toHaveTextContent('Saved'));
    expect(fileAccess.writes).toEqual(['Demo-house.epd']);
    expect(editorStore().getState().file).toMatchObject({ path: 'Demo-house.epd' });

    await addFloor();
    await clickSave();
    await waitFor(() => expect(fileAccess.writes).toEqual(['Demo-house.epd', 'Demo-house.epd']));
    expect(fileAccess.files.size).toBe(1);
  });

  // protects=AC 4 changed on disk; fails_when=Save overwrites a file another program changed without asking, Cancel writes anyway, or Overwrite does not write; no_claim=how the change is detected (main-process tests)
  it('asks before overwriting a file that changed on disk', async () => {
    const { fileAccess, original } = await openFromFile();
    await addFloor();
    fileAccess.touch('house.epd', new Uint8Array([1, 2, 3]));

    await clickSave();
    expect(await screen.findByText('The file changed on disk')).toBeInTheDocument();
    expect([...fileAccess.files.get('house.epd')!]).toEqual([1, 2, 3]);
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(fileAccess.writes).toEqual([]);
    expect(status()).not.toHaveTextContent('Saved');

    await clickSave();
    await userEvent.click(await screen.findByRole('button', { name: 'Overwrite' }));
    await waitFor(() => expect(status()).toHaveTextContent('Saved'));
    expect(fileAccess.writes).toEqual(['house.epd']);
    expect(floorsIn(fileAccess.files.get('house.epd')!)).toBe(floorsIn(original) + 1);

    // Save As from the same question writes a new file and leaves the changed one alone.
    await addFloor();
    fileAccess.touch('house.epd', new Uint8Array([4]));
    fileAccess.nextSaveAs = 'copy.epd';
    await clickSave();
    await userEvent.click(await screen.findByRole('button', { name: 'Save as…' }));
    await waitFor(() => expect(status()).toHaveTextContent('Saved'));
    expect([...fileAccess.files.get('house.epd')!]).toEqual([4]);
    expect(floorsIn(fileAccess.files.get('copy.epd')!)).toBe(floorsIn(original) + 2);
  });

  // protects=AC 5 write errors; fails_when=a failed write is marked saved, shows no OS error, offers no Save As, or loses the changes; no_claim=which OS errors occur (main-process tests)
  it('shows the OS error and offers Save As when the file cannot be written', async () => {
    const { fileAccess } = await openFromFile();
    await addFloor();
    fileAccess.failWrites = 'EACCES';
    await clickSave();
    expect(await screen.findByText('Could not save the file')).toBeInTheDocument();
    expect(screen.getByText(/EACCES/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Overwrite' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(status()).not.toHaveTextContent('Saved');
    expect(editorStore().getState().data.doc.floors).toHaveLength(4);

    await clickSave();
    fileAccess.failWrites = null;
    fileAccess.nextSaveAs = 'elsewhere.epd';
    await userEvent.click(await screen.findByRole('button', { name: 'Save as…' }));
    await waitFor(() => expect(status()).toHaveTextContent('Saved'));
    expect(fileAccess.files.has('elsewhere.epd')).toBe(true);
    expect(editorStore().getState().file).toMatchObject({ path: 'elsewhere.epd' });
  });

  // protects=failed saves; fails_when=an unexpected failure marks the project saved or fails silently; no_claim=the message of the underlying error
  it('keeps the unsaved state when saving throws', async () => {
    const { fileAccess } = await openFromFile();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(fileAccess, 'save').mockRejectedValueOnce(new Error('blocked'));
    await addFloor();
    await clickSave();
    expect(
      await screen.findByText('Could not save the project. Your changes are still in the editor.'),
    ).toBeInTheDocument();
    expect(status()).not.toHaveTextContent('Saved');
  });
});
