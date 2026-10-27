import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderApp } from '@/testing/renderApp';
import { pickOption } from '@/testing/select';

describe('app shell', () => {
  // protects=app shell renders per language; fails_when=a route or locale key is broken; no_claim=page content beyond the title
  it.each([
    ['en', 'Start'],
    ['it', 'Inizio'],
  ] as const)('renders the start screen title in %s', async (lng, title) => {
    await renderApp('/', { lng });
    expect(await screen.findByRole('heading', { name: title })).toBeInTheDocument();
  });

  // protects=language switch (AC 16); fails_when=switching keeps old strings; no_claim=persistence across reloads
  it('switches visible strings when the language changes', async () => {
    await renderApp('/settings/general', { project: null });
    expect(await screen.findByRole('heading', { name: 'General' })).toBeInTheDocument();
    await pickOption(screen.getByRole('combobox', { name: 'Language' }), 'Italiano');
    expect(await screen.findByRole('heading', { name: 'Generale' })).toBeInTheDocument();
  });
});

describe('editor layout shell', () => {
  // protects=editor frame (top bar, drawer, inspector); fails_when=the plan route loses a region; no_claim=canvas behavior
  it('shows the drawer tabs and an empty inspector on the plan view', async () => {
    await renderApp('/project/plan');
    expect(await screen.findByRole('tab', { name: 'Circuits' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'BOM' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /^Warnings/ })).toBeInTheDocument();
    expect(screen.getByText('Nothing selected.')).toBeInTheDocument();
  });
});

describe('Settings and Project routes', () => {
  // protects=the Settings sections and their default; fails_when=/settings does not open General, or a section path shows another page; no_claim=section content
  it.each([
    ['/settings', 'General'],
    ['/settings/general', 'General'],
    ['/settings/new-projects', 'New projects'],
  ] as const)('opens %s on the %s section', async (path, heading) => {
    await renderApp(path, { project: null });
    expect(await screen.findByRole('heading', { name: heading })).toBeInTheDocument();
  });

  // protects=old paths keep working after the rename; fails_when=a /library/* or /project/settings link lands on the not-found page; no_claim=the redirect being a permanent one
  it.each([
    ['/library', 'General', null],
    ['/library/company', 'Company', null],
    ['/library/defaults', 'New projects', null],
    ['/project/settings', 'Project details', 'project'],
  ] as const)('redirects %s to the %s page', async (path, heading, project) => {
    await renderApp(path, project ? undefined : { project: null });
    expect(await screen.findByRole('heading', { name: heading })).toBeInTheDocument();
  });
});
