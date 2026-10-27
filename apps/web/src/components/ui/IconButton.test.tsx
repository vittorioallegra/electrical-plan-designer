import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { IconButton } from './IconButton';

describe('IconButton', () => {
  // protects=icon-only buttons stay labelled and show a tooltip with the shortcut on keyboard focus; fails_when=the accessible name is lost or the tip does not appear; no_claim=hover delay
  it('is named by its label and shows label and shortcut on focus', async () => {
    const onClick = vi.fn();
    render(<IconButton label="Undo" shortcut="Cmd+Z" icon={<svg />} onClick={onClick} />);
    await userEvent.tab();
    const button = screen.getByRole('button', { name: 'Undo' });
    expect(button).toHaveFocus();
    expect(await screen.findByRole('tooltip')).toHaveTextContent('UndoCmd+Z');
    await userEvent.keyboard('{Enter}');
    expect(onClick).toHaveBeenCalledOnce();
  });

  // protects=toggle state exposure; fails_when=pressed is not reflected for assistive tech; no_claim=colors
  it('exposes the pressed state', () => {
    render(<IconButton label="Grid" pressed icon={<svg />} />);
    expect(screen.getByRole('button', { name: 'Grid' })).toHaveAttribute('aria-pressed', 'true');
  });

  // protects=disabled buttons do nothing; fails_when=a disabled icon button fires onClick; no_claim=—
  it('does not fire when disabled', async () => {
    const onClick = vi.fn();
    render(<IconButton label="Undo" disabled icon={<svg />} onClick={onClick} />);
    await userEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(onClick).not.toHaveBeenCalled();
  });
});
