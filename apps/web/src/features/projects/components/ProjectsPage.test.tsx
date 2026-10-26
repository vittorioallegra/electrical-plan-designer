import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { loadDoc } from '@epd/domain/load';
import { renderApp } from '@/testing/renderApp';

describe('projects page', () => {
  // protects=AC 1 create project; fails_when=a new project is not created with defaults and floor 1; no_claim=E2E against Supabase
  it('creates a project with default settings and one floor', async () => {
    const { control, router } = await renderApp('/projects', { seed: false });
    await userEvent.click((await screen.findAllByRole('button', { name: 'New project' }))[0]!);
    await userEvent.type(screen.getByLabelText('Project name'), 'Casa Rossi');
    await userEvent.type(screen.getByLabelText('Client'), 'Rossi');
    await userEvent.click(screen.getByRole('button', { name: 'Create' }));
    const [stored] = [...control.projects.values()];
    expect(stored!.meta.name).toBe('Casa Rossi');
    expect(stored!.settings.mountingHeights.socket).toBe(0.3);
    expect(loadDoc(stored!.doc).doc.floors.map((f) => f.name)).toEqual(['Floor 1']);
    await waitFor(() => expect(router.state.location.pathname).toBe('/project/plan'));
  });

  // protects=rename and delete; fails_when=rename is lost or delete skips the confirm; no_claim=storage cleanup on Supabase
  it('renames and deletes a project after confirmation', async () => {
    const { control } = await renderApp('/projects');
    const list = await screen.findByRole('list', { name: 'Projects' });
    await userEvent.click(within(list).getByRole('button', { name: 'Actions for Demo house' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Rename' }));
    const name = screen.getByLabelText('Project name');
    await userEvent.clear(name);
    await userEvent.type(name, 'Demo villa');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Demo villa')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Actions for Demo villa' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Delete' }));
    expect(control.projects.size).toBe(1);
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(await screen.findByText(/No projects yet/)).toBeInTheDocument();
    expect(control.projects.size).toBe(0);
  });
});
