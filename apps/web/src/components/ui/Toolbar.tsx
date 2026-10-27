import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/** Horizontal strip of controls. `floating` lifts it over a canvas with a shadow. */
export function Toolbar({
  'aria-label': ariaLabel,
  floating,
  className,
  children,
}: {
  'aria-label': string;
  floating?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      role="toolbar"
      aria-label={ariaLabel}
      className={cn(
        'flex h-10 items-center gap-1 px-2',
        floating
          ? 'rounded-md border border-border bg-raised shadow-pop'
          : 'border-b border-border bg-panel',
        className,
      )}
    >
      {children}
    </div>
  );
}
