import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Toolbar } from './Toolbar';

function setup() {
  render(
    <>
      <button>before</button>
      <Toolbar aria-label="Tools">
        <button>One</button>
        <button disabled>Two</button>
        <button>Three</button>
        <button>Four</button>
      </Toolbar>
      <button>after</button>
    </>,
  );
}

describe('Toolbar', () => {
  // protects=roving focus: one tab stop and arrow/Home/End navigation skipping disabled buttons; fails_when=Tab visits every button, or arrows do not move focus; no_claim=styling
  it('has one tab stop and moves with the arrow keys, Home and End', async () => {
    setup();
    expect(screen.getByRole('button', { name: 'One' })).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('button', { name: 'Three' })).toHaveAttribute('tabindex', '-1');
    await userEvent.tab();
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'One' })).toHaveFocus();
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('button', { name: 'Three' })).toHaveFocus();
    await userEvent.keyboard('{End}');
    expect(screen.getByRole('button', { name: 'Four' })).toHaveFocus();
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('button', { name: 'Four' })).toHaveFocus();
    await userEvent.keyboard('{Home}');
    expect(screen.getByRole('button', { name: 'One' })).toHaveFocus();
    await userEvent.keyboard('{ArrowLeft}');
    expect(screen.getByRole('button', { name: 'One' })).toHaveFocus();
  });

  // protects=the tab stop follows focus and Tab leaves the toolbar; fails_when=Tab goes to the next button inside the toolbar; no_claim=pointer behaviour
  it('remembers the last focused button as the tab stop and Tab leaves the toolbar', async () => {
    setup();
    await userEvent.click(screen.getByRole('button', { name: 'Three' }));
    expect(screen.getByRole('button', { name: 'Three' })).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('button', { name: 'One' })).toHaveAttribute('tabindex', '-1');
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'after' })).toHaveFocus();
    await userEvent.tab({ shift: true });
    expect(screen.getByRole('button', { name: 'Three' })).toHaveFocus();
  });
});
