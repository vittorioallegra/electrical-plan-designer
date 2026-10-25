import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';
import { routes } from './App';
import { createI18n, type Language } from './i18n';

function renderAt(path: string, lng: Language) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  return render(
    <I18nextProvider i18n={createI18n(lng)}>
      <RouterProvider router={router} />
    </I18nextProvider>,
  );
}

describe('app shell', () => {
  // protects=app shell renders per language; fails_when=a route or locale key is broken; no_claim=page content beyond the title
  it.each([
    ['en', 'Projects'],
    ['it', 'Progetti'],
  ] as const)('renders the project list title in %s', (lng, title) => {
    renderAt('/projects', lng);
    expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
  });

  // protects=language switch (AC 16); fails_when=switching keeps old strings; no_claim=persistence across reloads
  it('switches visible strings when the language changes', async () => {
    renderAt('/projects/p1/panel', 'en');
    expect(screen.getByRole('heading', { name: 'Panel designer' })).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Language'), 'it');
    expect(await screen.findByRole('heading', { name: 'Progetto quadro' })).toBeInTheDocument();
  });
});

describe('editor layout shell', () => {
  // protects=editor frame (top bar, drawer, inspector); fails_when=the plan route loses a region; no_claim=canvas behavior
  it('shows the drawer tabs and an empty inspector on the plan view', () => {
    renderAt('/projects/p1/plan', 'en');
    expect(screen.getByRole('tab', { name: 'Circuits' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'BOM' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Warnings' })).toBeInTheDocument();
    expect(screen.getByText('Nothing selected.')).toBeInTheDocument();
  });
});
