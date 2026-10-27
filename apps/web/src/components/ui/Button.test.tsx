import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Button } from './Button';

describe('Button', () => {
  // protects=quiet chrome buttons stay muted at rest and brighten on hover; fails_when=ghost-muted idles in text-text or loses the hover colour; no_claim=exact pixel colours
  it('draws ghost-muted in the muted text colour with a text hover', () => {
    render(<Button variant="ghost-muted">Quiet</Button>);
    const button = screen.getByRole('button', { name: 'Quiet' });
    expect(button).toHaveClass('text-text-muted', 'hover:text-text', 'hover:bg-hover');
    expect(button).not.toHaveClass('text-text');
  });

  // protects=pressed ghost-muted switches to the accent tint; fails_when=a pressed toggle keeps the muted colour; no_claim=aria semantics beyond aria-pressed
  it('shows the accent tint when pressed', () => {
    render(
      <Button variant="ghost-muted" pressed>
        Tab
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Tab' });
    expect(button).toHaveAttribute('aria-pressed', 'true');
    expect(button).toHaveClass('text-accent-text');
    expect(button).not.toHaveClass('text-text-muted');
  });
});
