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
  // protects=AC 1 save; fails_when=Save (button or Ctrl+S) does not download <project>.epd holding the open project, or the status does not become saved; no_claim=where the browser puts downloads
  it('downloads the project as <name>.epd on Save and on Ctrl+S', async () => {
    const { fileAccess } = await openDemo();
    await userEvent.click(screen.getByRole('button', { name: 'Add floor' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.getByTestId('save-status')).toHaveTextContent('Saved'));
    expect(fileAccess.downloads).toEqual(['Demo-house.epd']);
    expect(readEpd(fileAccess.files.get('Demo-house.epd')!).project).toEqual(
      editorStore().getState().data,
    );
    expect(await screen.findByText('Saved: Demo-house.epd downloaded')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Add floor' }));
    expect(screen.getByTestId('save-status')).not.toHaveTextContent('Saved');
    fireEvent.keyDown(window, { key: 's', ctrlKey: true });
    await waitFor(() => expect(screen.getByTestId('save-status')).toHaveTextContent('Saved'));
    expect(fileAccess.downloads).toEqual(['Demo-house.epd', 'Demo-house.epd']);
    expect(readEpd(fileAccess.files.get('Demo-house.epd')!).project.doc.floors).toHaveLength(5);
  });

  // protects=failed saves; fails_when=a project that cannot be written is marked saved or fails silently; no_claim=—
  it('keeps the unsaved state when the file cannot be built', async () => {
    const { fileAccess } = await openDemo();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(fileAccess, 'download').mockImplementationOnce(() => {
      throw new Error('blocked');
    });
    await userEvent.click(screen.getByRole('button', { name: 'Add floor' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(
      await screen.findByText('Could not save the project. The draft on this device is unchanged.'),
    ).toBeInTheDocument();
    expect(screen.getByTestId('save-status')).not.toHaveTextContent('Saved');
  });
});
