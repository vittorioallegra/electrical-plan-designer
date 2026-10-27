import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderApp } from '@/testing/renderApp';
import { pickOption } from '@/testing/select';

describe('general settings', () => {
  // protects=theme preference control; fails_when=the control does not show the stored theme, or choosing a theme does not reach the preferences repository; no_claim=how main applies the theme (desktop tests)
  it('shows the stored theme and saves a change', async () => {
    const app = await renderApp('/settings/general', { project: null });
    const system = await screen.findByRole('radio', { name: 'System' });
    expect(system).toBeChecked();
    await userEvent.click(screen.getByRole('radio', { name: 'Dark' }));
    expect(screen.getByRole('radio', { name: 'Dark' })).toBeChecked();
    await waitFor(() => expect(app.preferences.getTheme()).resolves.toBe('dark'));
  });

  // protects=language control moved from the top bar; fails_when=the language select is missing from General, shows another language, or does not switch the visible strings; no_claim=persistence across reloads
  it('switches the language', async () => {
    await renderApp('/settings/general', { project: null });
    const select = await screen.findByRole('combobox', { name: 'Language' });
    expect(select).toHaveTextContent('English');
    await pickOption(select, 'Italiano');
    expect(await screen.findByRole('heading', { name: 'Generale' })).toBeInTheDocument();
  });
});
