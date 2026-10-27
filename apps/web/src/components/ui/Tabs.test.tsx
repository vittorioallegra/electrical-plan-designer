import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Tabs } from './Tabs';

const tabs = [
  { value: 'one', label: 'One', content: <p>First panel</p> },
  { value: 'two', label: 'Two', content: <p>Second panel</p> },
];

describe('Tabs', () => {
  // protects=arrow-key navigation in both variants; fails_when=ArrowRight does not move to and show the next tab; no_claim=visual difference of the variants
  it.each(['underline', 'segmented'] as const)(
    'moves with the arrow keys (%s)',
    async (variant) => {
      render(<Tabs tabs={tabs} variant={variant} />);
      await userEvent.click(screen.getByRole('tab', { name: 'One' }));
      await userEvent.keyboard('{ArrowRight}');
      expect(screen.getByRole('tab', { name: 'Two' })).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByText('Second panel')).toBeInTheDocument();
    },
  );
});
