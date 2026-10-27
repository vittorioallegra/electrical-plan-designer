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
