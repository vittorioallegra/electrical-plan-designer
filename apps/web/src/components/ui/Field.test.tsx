import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Badge } from './Badge';
import { EmptyState } from './EmptyState';
import { PanelSection } from './PanelSection';
import { TextField } from './TextField';
import { Toolbar } from './Toolbar';

describe('small ui components', () => {
  // protects=invalid state is announced; fails_when=the message is not linked to the input or aria-invalid is missing; no_claim=message wording
  it('TextField links its error message and label', () => {
    render(<TextField label="Name" error="Required" unit="m" defaultValue="" />);
    const input = screen.getByLabelText('Name');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Required');
  });

  // protects=landmarks and labels; fails_when=toolbar, section heading or empty message disappear; no_claim=layout
  it('Toolbar, PanelSection, EmptyState and Badge render their content', () => {
    render(
      <>
        <Toolbar aria-label="Tools">
          <button>x</button>
        </Toolbar>
        <PanelSection title="Layers" actions={<button>add</button>}>
          body
        </PanelSection>
        <EmptyState message="No items yet" action={<button>Create</button>} />
        <Badge tone="warning">Missing</Badge>
      </>,
    );
    expect(screen.getByRole('toolbar', { name: 'Tools' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Layers' })).toBeInTheDocument();
    expect(screen.getByText('No items yet')).toBeInTheDocument();
    expect(screen.getByText('Missing')).toBeInTheDocument();
  });
});
