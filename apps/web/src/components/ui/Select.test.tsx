import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Select } from './Select';

const options = [
  { value: '', label: 'None' },
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta' },
];

function Harness({ onChange = vi.fn() }: { onChange?: (v: string) => void }) {
  const [value, setValue] = useState('');
  return (
    <Select
      aria-label="Pick"
      value={value}
      options={options}
      onValueChange={(v) => {
        setValue(v);
        onChange(v);
      }}
    />
  );
}

describe('Select', () => {
  // protects=a caller-set width; fails_when=the trigger carries its own width utility, which beats the caller's (cn does not merge utilities); no_claim=layout
  it('takes its full-width default from a class a caller width utility overrides', () => {
    render(
      <Select
        aria-label="Pick"
        className="w-40"
        value="a"
        options={options}
        onValueChange={vi.fn()}
      />,
    );
    const trigger = screen.getByRole('combobox', { name: 'Pick' });
    expect(trigger).toHaveClass('select-trigger', 'w-40');
    expect(trigger.className).not.toMatch(/(^|\s)w-full(\s|$)/);
  });

  // protects=keyboard choice and the empty option; fails_when=Enter does not pick the highlighted option or "None" is lost; no_claim=popover placement
  it('opens from the keyboard, picks an option and can pick the empty one back', async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const trigger = screen.getByRole('combobox', { name: 'Pick' });
    expect(trigger).toHaveTextContent('None');
    trigger.focus();
    await userEvent.keyboard('{Enter}');
    await userEvent.click(screen.getByRole('option', { name: 'Beta' }));
    expect(onChange).toHaveBeenLastCalledWith('b');
    expect(trigger).toHaveTextContent('Beta');
    await userEvent.click(trigger);
    await userEvent.click(screen.getByRole('option', { name: 'None' }));
    expect(onChange).toHaveBeenLastCalledWith('');
  });

  // protects=disabled state; fails_when=a disabled select opens; no_claim=styling
  it('does not open when disabled', async () => {
    render(
      <Select aria-label="Pick" disabled value="a" options={options} onValueChange={vi.fn()} />,
    );
    const trigger = screen.getByRole('combobox', { name: 'Pick' });
    expect(trigger).toBeDisabled();
    await userEvent.click(trigger);
    expect(screen.queryByRole('option')).toBeNull();
  });
});
