import { render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { describe, expect, it } from 'vitest';
import { createI18n } from '@/lib/i18n';
import { LoadingState } from './LoadingState';

describe('LoadingState', () => {
  // protects=the shared loading line is announced as a status; fails_when=the line has no status role or text; no_claim=where routes use it
  it('renders a status with the loading text', () => {
    render(
      <I18nextProvider i18n={createI18n('en')}>
        <LoadingState />
      </I18nextProvider>,
    );
    expect(screen.getByRole('status')).toHaveTextContent('Loading…');
  });
});
