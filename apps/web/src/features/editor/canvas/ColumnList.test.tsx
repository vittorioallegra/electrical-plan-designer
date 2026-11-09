import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';
import { describe, expect, it, vi } from 'vitest';
import type { PlanNode } from '@epd/domain/types';
import { createI18n } from '@/lib/i18n';
import { ColumnList } from './ColumnList';

const box = (id: string, mounting: PlanNode['mounting']): PlanNode => ({
  id,
  floorId: 'f0',
  kind: 'terminal_box',
  position: { x: 1, y: 1 },
  label: id,
  status: 'active',
  mounting,
  stackId: 'k',
});

function renderList(overrides: Partial<Parameters<typeof ColumnList>[0]> = {}) {
  const props = {
    members: [box('S4', 'switch'), box('S1', 'socket')],
    heightM: (id: string) => (id === 'S4' ? 1.1 : 0.3),
    anchor: { x: 100, y: 100 },
    boundsWidth: 1000,
    selected: new Set<string>(),
    warned: new Set(['S1']),
    onPick: vi.fn(),
    onHover: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
  render(
    <I18nextProvider i18n={createI18n('en')}>
      <ColumnList {...props} />
    </I18nextProvider>,
  );
  return props;
}

describe('column list', () => {
  // protects=exploded column rows; fails_when=boxes are not listed top to bottom with their heights, a warned box has no mark, or a row does not pick its box; no_claim=placement on the canvas
  it('lists the boxes top to bottom and picks one', async () => {
    const props = renderList();
    expect(screen.getByRole('group', { name: 'Column · 2 boxes, top to bottom' })).toBeVisible();
    const rows = screen.getAllByRole('button');
    expect(rows.map((r) => r.textContent)).toEqual(['S41.10 m', 'S10.30 m']);
    expect(screen.getByLabelText('Has a warning')).toBeInTheDocument();
    await userEvent.click(rows[1]!);
    expect(props.onPick).toHaveBeenCalledWith('S1');
  });

  // protects=keyboard use of the list; fails_when=the list does not take focus, arrows do not move between rows, Enter does not pick or Escape does not close; no_claim=—
  it('works from the keyboard', async () => {
    const props = renderList({ selected: new Set(['S1']) });
    expect(screen.getAllByRole('button')[1]).toHaveFocus();
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getAllByRole('button')[0]).toHaveFocus();
    expect(props.onHover).toHaveBeenLastCalledWith('S4');
    await userEvent.keyboard('{Enter}');
    expect(props.onPick).toHaveBeenCalledWith('S4');
    await userEvent.keyboard('{Escape}');
    expect(props.onClose).toHaveBeenCalled();
  });

  // protects=a conduit cannot end where it starts; fails_when=the start box of the conduit can be picked; no_claim=—
  it('disables the boxes that cannot be picked', () => {
    renderList({ disabled: new Set(['S4']) });
    expect(screen.getAllByRole('button')[0]).toBeDisabled();
  });
});
