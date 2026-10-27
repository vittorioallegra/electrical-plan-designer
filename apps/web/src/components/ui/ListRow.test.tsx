import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ListRow } from './ListRow';

describe('ListRow', () => {
  // protects=the row is one button named by label, description and meta, and fires onClick from the keyboard; fails_when=the label is not in the accessible name, or Enter does not select; no_claim=the look
  it('is a keyboard-operable button named by its content', async () => {
    const onClick = vi.fn();
    render(<ListRow label="Plan.epd" description="/Users/me" meta="12 Oct" onClick={onClick} />);
    await userEvent.tab();
    const button = screen.getByRole('button', { name: 'Plan.epd/Users/me12 Oct' });
    expect(button).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(onClick).toHaveBeenCalledOnce();
  });

  // protects=trailing actions stay outside the row's button, so there are no nested interactives and the row name stays clean; fails_when=an action renders inside the row button; no_claim=the menu itself
  it('renders trailing actions beside the row button', async () => {
    const onClick = vi.fn();
    const onMore = vi.fn();
    render(
      <ListRow label="Main" onClick={onClick} trailing={<button onClick={onMore}>More</button>} />,
    );
    const row = screen.getByRole('button', { name: 'Main' });
    expect(row).not.toContainElement(screen.getByRole('button', { name: 'More' }));
    await userEvent.click(screen.getByRole('button', { name: 'More' }));
    expect(onMore).toHaveBeenCalledOnce();
    expect(onClick).not.toHaveBeenCalled();
  });

  // protects=role and selection state pass through for tabs and options; fails_when=role or aria-selected is dropped; no_claim=fill colour
  it('passes role and aria state to the button', () => {
    render(<ListRow label="Ground floor" role="tab" aria-selected selected />);
    expect(screen.getByRole('tab', { name: 'Ground floor' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });
});
