import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEMO_PROJECT_ID, renderApp } from '@/testing/renderApp';

const mobilePath = `/m/projects/${DEMO_PROJECT_ID}`;
const BOX = 'builtin:box_503';

afterEach(() => sessionStorage.clear());

function row(key: string) {
  return document.querySelector<HTMLElement>(`[data-testid="checklist"] [data-key="${key}"]`)!;
}

describe('mobile light view', () => {
  // protects=AC 14 tick on the phone; fails_when=ticking does not store the BOM quantity or unticking does not clear it; no_claim=sync across devices (E2E)
  it('ticks and unticks a line with its full quantity', async () => {
    const { repos } = await renderApp(mobilePath);
    await screen.findByTestId('checklist');
    await userEvent.click(within(row(BOX)).getByRole('checkbox'));
    expect(row(BOX)).toHaveAttribute('data-status', 'done');
    await waitFor(async () =>
      expect((await repos.purchases.list(DEMO_PROJECT_ID)).get(BOX)).toBe(4),
    );
    expect(screen.getByText(/^1 of \d+ bought$/)).toBeInTheDocument();

    await userEvent.click(within(row(BOX)).getByRole('checkbox'));
    await waitFor(async () =>
      expect((await repos.purchases.list(DEMO_PROJECT_ID)).get(BOX)).toBeNull(),
    );
  });

  // protects=shortfall and orphan marks; fails_when=a short purchase looks done or a mark for a removed line disappears; no_claim=—
  it('shows a shortfall and marks that left the BOM', async () => {
    const { repos } = await renderApp(mobilePath);
    await screen.findByTestId('checklist');
    await repos.purchases.set(DEMO_PROJECT_ID, BOX, 3);
    await repos.purchases.set(DEMO_PROJECT_ID, 'cable:6:black', 20);
    // Switching tabs remounts the checklist, which reloads the marks.
    await userEvent.click(screen.getByRole('tab', { name: 'Plan' }));
    await userEvent.click(screen.getByRole('tab', { name: 'Checklist' }));
    await screen.findByTestId('checklist');
    expect(row(BOX)).toHaveAttribute('data-status', 'partial');
    expect(row(BOX)).toHaveTextContent('Bought 3 pcs / need 4 pcs');
    const orphans = screen.getByRole('region', { name: 'No longer in the BOM' });
    expect(orphans).toHaveTextContent('Cable H07V-K 6 mm² black');

    await userEvent.click(screen.getByLabelText('Show remaining only'));
    expect(row(BOX)).not.toBeNull();
    await userEvent.click(within(row(BOX)).getByRole('checkbox'));
    expect(document.querySelector(`[data-key="${BOX}"]`)).toBeNull();
  });

  // protects=optimistic toggle rollback; fails_when=a failed save leaves the line ticked or shows no error; no_claim=—
  it('rolls back a tick that could not be saved', async () => {
    const { repos } = await renderApp(mobilePath);
    vi.spyOn(repos.purchases, 'set').mockRejectedValueOnce(new Error('offline'));
    await screen.findByTestId('checklist');
    await userEvent.click(within(row(BOX)).getByRole('checkbox'));
    await waitFor(() => expect(row(BOX)).toHaveAttribute('data-status', 'not_bought'));
    expect(await screen.findByText(/Could not save the purchase/)).toBeInTheDocument();
  });

  // protects=purchase marks load failure; fails_when=a failed load shows every line as not bought or retry does not recover; no_claim=desktop BOM tab wiring
  it('shows a load error with retry instead of an empty checklist', async () => {
    const { repos } = await renderApp(mobilePath);
    await screen.findByTestId('checklist');
    await repos.purchases.set(DEMO_PROJECT_ID, BOX, 4);
    vi.spyOn(repos.purchases, 'list').mockRejectedValueOnce(new Error('offline'));
    // Switching tabs remounts the checklist, which reloads the marks.
    await userEvent.click(screen.getByRole('tab', { name: 'Plan' }));
    await userEvent.click(screen.getByRole('tab', { name: 'Checklist' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not load the purchase checklist',
    );
    expect(screen.queryByTestId('checklist')).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await screen.findByTestId('checklist');
    expect(row(BOX)).toHaveAttribute('data-status', 'done');
  });

  // protects=viewport mode routing; fails_when=a phone session opens the desktop editor; no_claim=width detection (unit test)
  it('sends a mobile session from the editor to the mobile view', async () => {
    sessionStorage.setItem('epd.viewMode', 'mobile');
    const { router } = await renderApp(`/projects/${DEMO_PROJECT_ID}/plan`);
    await screen.findByTestId('checklist');
    expect(router.state.location.pathname).toBe(mobilePath);
  });
});
