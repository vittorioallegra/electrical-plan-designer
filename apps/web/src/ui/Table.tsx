import type { ReactNode } from 'react';
import { cn } from './cn';

export interface Column<T> {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  align?: 'left' | 'right';
}

export function Table<T>({
  columns,
  rows,
  rowKey,
  className,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  className?: string;
}) {
  return (
    <table className={cn('w-full border-collapse text-left', className)}>
      <thead>
        <tr className="border-b border-border text-text-muted">
          {columns.map((c) => (
            <th
              key={c.key}
              scope="col"
              className={cn('px-2 py-1 font-medium', c.align === 'right' && 'text-right')}
            >
              {c.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={rowKey(row)} className="border-b border-border/60">
            {columns.map((c) => (
              <td
                key={c.key}
                className={cn('px-2 py-1', c.align === 'right' && 'text-right tabular-nums')}
              >
                {c.cell(row)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
