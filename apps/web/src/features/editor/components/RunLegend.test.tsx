import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';
import { describe, expect, it } from 'vitest';
import { runDash } from '@/features/editor/canvas/canvasColors';
import { createI18n } from '@/lib/i18n';
import { RunLegend } from './RunLegend';

const renderLegend = () =>
  render(
    <I18nextProvider i18n={createI18n('en')}>
      <RunLegend />
    </I18nextProvider>,
  );

describe('run legend', () => {
  // protects=the three laying types are told apart by dash pattern; fails_when=a pattern is missing, differs from the canvas one or has no label; no_claim=colour (theme tokens)
  it('shows the three dash patterns with their labels', () => {
    renderLegend();
    for (const el of ['floor', 'ceiling', 'direct'] as const) {
      expect(screen.getByTestId(`legend-dash-${el}`)).toHaveAttribute(
        'stroke-dasharray',
        runDash[el].join(' '),
      );
    }
    expect(screen.getByText('At floor')).toBeVisible();
    expect(screen.getByText('At ceiling')).toBeVisible();
    expect(screen.getByText('Direct (in the wall)')).toBeVisible();
  });

  // protects=the legend collapses out of the way; fails_when=the toggle does not hide the patterns or show them again; no_claim=animation
  it('collapses and expands', async () => {
    renderLegend();
    const toggle = screen.getByRole('button', { name: 'Conduit runs' });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText('At floor')).not.toBeVisible();
    await userEvent.click(toggle);
    expect(screen.getByText('At floor')).toBeVisible();
  });
});
