import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Table, type Column } from './Table';

interface Row {
  id: string;
  name: string;
  qty: number;
}
const columns: Column<Row>[] = [
  { key: 'name', header: 'Name', cell: (r) => r.name },
  { key: 'qty', header: 'Qty', cell: (r) => r.qty, align: 'right' },
];
const rows: Row[] = [
  { id: 'a', name: 'Socket', qty: 3 },
  { id: 'b', name: 'Switch', qty: 1 },
];

describe('Table', () => {
  // protects=keyboard-selectable rows and selected state; fails_when=Enter, Space or click does not report the row or aria-selected is missing; no_claim=hover styling
  it('selects rows by click and Enter and marks the selected one', async () => {
    const onRowClick = vi.fn();
    render(
      <Table
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        selectedKey="b"
        onRowClick={onRowClick}
      />,
    );
    const [socket, switchRow] = screen.getAllByRole('row').slice(1);
    expect(switchRow).toHaveAttribute('aria-selected', 'true');
    expect(socket).toHaveAttribute('aria-selected', 'false');
    await userEvent.click(socket!);
    expect(onRowClick).toHaveBeenLastCalledWith(rows[0]);
    socket!.focus();
    await userEvent.keyboard('{Enter}');
    expect(onRowClick).toHaveBeenCalledTimes(2);
    await userEvent.keyboard(' ');
    expect(onRowClick).toHaveBeenCalledTimes(3);
  });

  // protects=grid semantics and roving focus of selectable tables; fails_when=rows are all tab stops, arrows/Home/End do not move between rows, or a plain table gets grid roles or aria-selected; no_claim=selection styling
  it('is a grid with one tab stop and Up/Down/Home/End row navigation when selectable', async () => {
    const onRowClick = vi.fn();
    const { rerender } = render(
      <>
        <button>before</button>
        <Table
          columns={columns}
          rows={rows}
          rowKey={(r) => r.id}
          selectedKey="b"
          onRowClick={onRowClick}
        />
        <button>after</button>
      </>,
    );
    expect(screen.getByRole('grid')).toBeInTheDocument();
    expect(screen.getAllByRole('columnheader')).toHaveLength(2);
    expect(screen.getAllByRole('gridcell')).toHaveLength(4);
    const [socket, switchRow] = screen.getAllByRole('row').slice(1);
    // The selected row is the single tab stop.
    expect(switchRow).toHaveAttribute('tabindex', '0');
    expect(socket).toHaveAttribute('tabindex', '-1');
    await userEvent.tab();
    await userEvent.tab();
    expect(switchRow).toHaveFocus();
    await userEvent.keyboard('{ArrowUp}');
    expect(socket).toHaveFocus();
    await userEvent.keyboard('{End}');
    expect(switchRow).toHaveFocus();
    await userEvent.keyboard('{Home}');
    expect(socket).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(onRowClick).toHaveBeenLastCalledWith(rows[0]);
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'after' })).toHaveFocus();

    rerender(<Table columns={columns} rows={rows} rowKey={(r) => r.id} />);
    expect(screen.getByRole('table')).toBeInTheDocument();
    for (const row of screen.getAllByRole('row')) {
      expect(row).not.toHaveAttribute('aria-selected');
      expect(row).not.toHaveAttribute('tabindex');
    }
  });

  // protects=empty state inside the frame and numeric alignment; fails_when=no rows renders nothing or numbers are not right-aligned; no_claim=sticky offset
  it('shows the empty state and right-aligns numeric columns', () => {
    const { rerender } = render(
      <Table columns={columns} rows={[]} rowKey={(r) => r.id} empty={<p>Nothing here</p>} />,
    );
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
    rerender(<Table columns={columns} rows={rows} rowKey={(r) => r.id} />);
    expect(screen.getByText('3')).toHaveClass('text-right');
  });
});
