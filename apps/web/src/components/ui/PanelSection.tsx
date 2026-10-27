import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/** Docked panel block: 11px uppercase header with optional actions on the right. */
export function PanelSection({
  title,
  actions,
  className,
  children,
}: {
  title: string;
  actions?: ReactNode;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <section className={cn('border-b border-border', className)}>
      <header className="flex h-8 items-center justify-between gap-2 px-3">
        <h3 className="text-label font-semibold tracking-wide text-text-muted uppercase">
          {title}
        </h3>
        {actions ? <div className="flex items-center gap-1">{actions}</div> : null}
      </header>
      {children ? <div className="px-3 pb-3">{children}</div> : null}
    </section>
  );
}
