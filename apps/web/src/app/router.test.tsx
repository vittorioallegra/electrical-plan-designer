import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { DEMO_PROJECT_ID, renderApp } from '@/testing/renderApp';

describe('app shell', () => {
  // protects=app shell renders per language; fails_when=a route or locale key is broken; no_claim=page content beyond the title
  it.each([
    ['en', 'Projects'],
    ['it', 'Progetti'],
  ] as const)('renders the project list title in %s', async (lng, title) => {
    await renderApp('/projects', { lng });
    expect(await screen.findByRole('heading', { name: title })).toBeInTheDocument();
  });

  // protects=language switch (AC 16); fails_when=switching keeps old strings; no_claim=persistence across reloads
  it('switches visible strings when the language changes', async () => {
    await renderApp(`/projects/${DEMO_PROJECT_ID}/panel`);
    expect(await screen.findByRole('heading', { name: 'Panel designer' })).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Language'), 'it');
    expect(await screen.findByRole('heading', { name: 'Progetto quadro' })).toBeInTheDocument();
  });
});

describe('editor layout shell', () => {
  // protects=editor frame (top bar, drawer, inspector); fails_when=the plan route loses a region; no_claim=canvas behavior
  it('shows the drawer tabs and an empty inspector on the plan view', async () => {
    await renderApp(`/projects/${DEMO_PROJECT_ID}/plan`);
    expect(await screen.findByRole('tab', { name: 'Circuits' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'BOM' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /^Warnings/ })).toBeInTheDocument();
    expect(screen.getByText('Nothing selected.')).toBeInTheDocument();
  });
});
