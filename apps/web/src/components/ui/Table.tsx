import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface Column<T> {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  /** `right` also sets the cells in mono tabular figures (numeric columns). */
  align?: 'left' | 'right';
  /** Extra classes on the header and the cells, e.g. to hide the column on narrow windows. */
  className?: string;
}

export function Table<T>({
  columns,
  rows,
  rowKey,
  className,
  selectedKey,
  onRowClick,
  empty,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  className?: string;
  /** Highlights the row with this key. */
  selectedKey?: string | null;
  /** Makes rows selectable by click and by Enter/Space on the focused row. */
  onRowClick?: (row: T) => void;
  /** Shown inside the table frame when there are no rows. */
  empty?: ReactNode;
}) {
  return (
    <table className={cn('w-full border-collapse text-left text-body', className)}>
      <thead>
        <tr>
          {columns.map((c) => (
            <th
              key={c.key}
              scope="col"
              className={cn(
                'sticky top-0 z-[1] h-8 border-b border-border bg-panel px-3 text-small font-medium text-text-muted',
                c.align === 'right' && 'text-right',
                c.className,
              )}
            >
              {c.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 && empty ? (
          <tr>
            <td colSpan={columns.length}>{empty}</td>
          </tr>
        ) : null}
        {rows.map((row) => {
          const key = rowKey(row);
          const selected = selectedKey === key;
          return (
            <tr
              key={key}
              aria-selected={onRowClick ? selected : undefined}
              tabIndex={onRowClick ? 0 : undefined}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              onKeyDown={
                onRowClick
                  ? (e) => {
                      if (e.target !== e.currentTarget) return;
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onRowClick(row);
                      }
                    }
                  : undefined
              }
              className={cn(
                'h-9 border-b border-border transition-colors duration-[80ms] hover:bg-hover',
                onRowClick && 'cursor-pointer',
                selected && 'bg-accent-subtle hover:bg-accent-subtle',
              )}
            >
              {columns.map((c) => (
                <td
                  key={c.key}
                  className={cn(
                    'px-3',
                    c.align === 'right' && 'text-right font-mono tabular-nums',
                    c.className,
                  )}
                >
                  {c.cell(row)}
                </td>
              ))}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
