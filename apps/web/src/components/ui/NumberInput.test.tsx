import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';
import { describe, expect, it, vi } from 'vitest';
import { createI18n } from '@/lib/i18n';
import { NumberInput } from './NumberInput';

describe('NumberInput', () => {
  // protects=comma decimals in Italian inputs; fails_when="4,20" commits 420 or nothing; no_claim=caret behavior
  it('commits a comma decimal in Italian on Enter', async () => {
    const onValueChange = vi.fn();
    render(
      <I18nextProvider i18n={createI18n('it')}>
        <NumberInput aria-label="len" value={1} onValueChange={onValueChange} unit="m" />
      </I18nextProvider>,
    );
    const input = screen.getByLabelText('len');
    expect(input).toHaveValue('1');
    await userEvent.clear(input);
    await userEvent.type(input, '4,20{Enter}');
    expect(onValueChange).toHaveBeenCalledWith(4.2);
  });

  // protects=range validation; fails_when=an out-of-range value is committed; no_claim=message wording
  it('flags and does not commit out-of-range values', async () => {
    const onValueChange = vi.fn();
    render(
      <I18nextProvider i18n={createI18n('en')}>
        <NumberInput aria-label="len" value={1} min={0} onValueChange={onValueChange} />
      </I18nextProvider>,
    );
    const input = screen.getByLabelText('len');
    await userEvent.clear(input);
    await userEvent.type(input, '-3');
    await userEvent.tab();
    expect(onValueChange).not.toHaveBeenCalled();
    expect(input).toHaveAttribute('aria-invalid', 'true');
  });
});

describe('NumberInput live mode', () => {
  // protects=dialog fields; fails_when=a typed value is only reported after blur, leaving the confirm button disabled; no_claim=—
  it('reports valid values while typing', async () => {
    const onValueChange = vi.fn();
    render(
      <I18nextProvider i18n={createI18n('en')}>
        <NumberInput aria-label="d" value={null} live min={0.01} onValueChange={onValueChange} />
      </I18nextProvider>,
    );
    await userEvent.type(screen.getByLabelText('d'), '4.2');
    expect(onValueChange).toHaveBeenLastCalledWith(4.2);
  });
});
