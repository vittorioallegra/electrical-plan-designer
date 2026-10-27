import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

/** Opens the bottom panel on a tab with the status bar button (the panel is closed by default). */
export async function openDrawer(name: 'Circuits' | 'BOM' | 'Warnings') {
  const bar = await screen.findByRole('toolbar', { name: 'Panels' });
  await userEvent.click(within(bar).getByRole('button', { name: new RegExp(`^${name}`) }));
  return screen.findByRole('tab', { name: new RegExp(`^${name}`), selected: true });
}
