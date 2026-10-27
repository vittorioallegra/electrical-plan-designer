import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SegmentedControl } from './SegmentedControl';

const options = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

describe('SegmentedControl', () => {
  // protects=exclusive choice; fails_when=clicking the selected segment clears the value; no_claim=visual style
  it('selects by click and never unselects', async () => {
    const onValueChange = vi.fn();
    render(
      <SegmentedControl
        aria-label="Theme"
        options={options}
        value="system"
        onValueChange={onValueChange}
      />,
    );
    expect(screen.getByRole('radiogroup', { name: 'Theme' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: 'System' }));
    expect(onValueChange).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('radio', { name: 'Dark' }));
    expect(onValueChange).toHaveBeenCalledWith('dark');
  });
});
