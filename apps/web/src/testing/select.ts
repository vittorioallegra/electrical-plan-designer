import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

/** Opens a Radix `Select` trigger and picks the option with the given accessible name. */
export async function pickOption(trigger: HTMLElement, name: string | RegExp) {
  await userEvent.click(trigger);
  await userEvent.click(await screen.findByRole('option', { name }));
}
