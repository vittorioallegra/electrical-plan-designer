import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { useRovingFocus } from '@/hooks/useRovingFocus';

/** Selector of the controls a toolbar moves focus between (enabled buttons). */
export const TOOLBAR_ITEMS = 'button:not(:disabled)';

/**
 * Horizontal strip of controls with roving focus (one tab stop, Left/Right, Home/End).
 * `floating` lifts it over a canvas with a shadow.
 */
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
  const roving = useRovingFocus<HTMLDivElement>(TOOLBAR_ITEMS);
  return (
    <div
      role="toolbar"
      aria-label={ariaLabel}
      {...roving}
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
