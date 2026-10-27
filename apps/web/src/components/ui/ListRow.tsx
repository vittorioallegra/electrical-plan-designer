import type { ComponentPropsWithRef, ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface ListRowProps extends Omit<ComponentPropsWithRef<'button'>, 'children'> {
  label: ReactNode;
  /** Second line under the label (a folder, a detail); makes the row taller. */
  description?: ReactNode;
  /** Right-aligned text or badge, part of the row's button (and of its accessible name). */
  meta?: ReactNode;
  /** Leading icon; decorative. */
  icon?: ReactNode;
  /** Selection fill. Set `aria-selected`, `aria-pressed` or `aria-current` as well. */
  selected?: boolean;
  /** Muted label, for a secondary action row such as "Import". */
  muted?: boolean;
  /** Extra left padding, to align under a section title. */
  indent?: boolean;
  /** Actions (icon buttons, a menu) at the right edge, outside the row's own button. */
  trailing?: ReactNode;
}

/**
 * Selectable list row: icon, label, optional description and meta, and trailing actions.
 * 28px high (52px with a description). Selected = `accent-subtle` fill, as in DESIGN.md.
 */
export function ListRow({
  label,
  description,
  meta,
  icon,
  selected,
  muted,
  indent,
  trailing,
  className,
  type = 'button',
  ...props
}: ListRowProps) {
  const tall = description !== undefined;
  return (
    <div
      className={cn(
        'flex items-center rounded-md',
        selected ? 'bg-accent-subtle' : 'hover:bg-hover',
        className,
      )}
    >
      <button
        type={type}
        className={cn(
          'flex min-w-0 flex-1 items-center rounded-md text-left text-body focus-visible:outline-2 focus-visible:outline-offset-1',
          tall ? 'h-13 gap-3 px-3' : 'h-7 gap-2 px-2',
          indent && 'pl-5',
          selected
            ? 'font-medium text-accent-text'
            : muted
              ? 'text-text-muted hover:text-text'
              : 'text-text',
        )}
        {...props}
      >
        {icon ? (
          <span aria-hidden className="inline-flex shrink-0 items-center">
            {icon}
          </span>
        ) : null}
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{label}</span>
          {tall ? (
            <span className="block truncate text-small text-text-faint">{description}</span>
          ) : null}
        </span>
        {meta ? <span className="shrink-0 text-small text-text-muted tnum">{meta}</span> : null}
      </button>
      {trailing}
    </div>
  );
}
