import { ChevronRight } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * Docked panel block: 11px uppercase header with optional actions on the right. A collapsible
 * section opens and closes from its header and starts closed unless `defaultOpen`.
 */
export function PanelSection({
  title,
  actions,
  className,
  collapsible = false,
  defaultOpen = false,
  children,
}: {
  title: string;
  actions?: ReactNode;
  className?: string;
  collapsible?: boolean;
  defaultOpen?: boolean;
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(!collapsible || defaultOpen);
  const bodyId = useId();
  const heading = (
    <h3 className="text-label font-semibold tracking-wide text-text-muted uppercase">{title}</h3>
  );
  return (
    <section className={cn('border-b border-border', className)}>
      <div className="flex h-8 items-center justify-between gap-2 px-3">
        {collapsible ? (
          <button
            type="button"
            className="-mx-1 flex h-6 items-center gap-1 rounded-sm px-1 text-text-muted transition-colors duration-[80ms] hover:text-text focus-visible:outline-2 focus-visible:outline-offset-1"
            aria-expanded={open}
            aria-controls={bodyId}
            onClick={() => setOpen(!open)}
          >
            <ChevronRight
              size={14}
              aria-hidden
              className={cn('transition-transform', open && 'rotate-90')}
            />
            {heading}
          </button>
        ) : (
          heading
        )}
        {actions ? <div className="flex items-center gap-1">{actions}</div> : null}
      </div>
      {children && open ? (
        <div id={bodyId} className="px-3 pb-3">
          {children}
        </div>
      ) : null}
    </section>
  );
}
