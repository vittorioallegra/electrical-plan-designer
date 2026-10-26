import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { EditorStore } from '@/stores/editor/editorStore';
import { DEMO_PROJECT_ID, renderApp } from '@/testing/renderApp';

const editorStore = () => (window as unknown as { __epd: { store: EditorStore } }).__epd.store;

describe('company page', () => {
  // protects=company data per project; fails_when=fields or the logo are not stored in the project, or undo does not reach the form; no_claim=quote PDF layout (quotePdf.test)
  it('edits the company and embeds the logo as a project asset', async () => {
    await renderApp(`/projects/${DEMO_PROJECT_ID}/company`, { exposeTestHandle: true });
    const name = await screen.findByLabelText('Business name');
    await userEvent.type(name, 'Elettricità Rossi');
    await userEvent.tab();
    expect(editorStore().getState().data.company.businessName).toBe('Elettricità Rossi');

    const logo = new File([new Uint8Array([137, 80, 78, 71])], 'logo.png', { type: 'image/png' });
    await userEvent.upload(screen.getByLabelText('Logo'), logo);
    await waitFor(() => expect(editorStore().getState().data.company.logoAssetId).toBeDefined());
    const { data, assets } = editorStore().getState();
    expect([...assets.get(data.company.logoAssetId!)!.bytes]).toEqual([137, 80, 78, 71]);

    await userEvent.click(screen.getByRole('button', { name: 'Undo' }));
    await userEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(screen.getByLabelText('Business name')).toHaveValue('');
  });
});
