import type { ReactNode } from 'react';

/** Title row of a Settings section: the page's `h1`, an optional hint and actions on the right. */
export function PageHeader({
  title,
  hint,
  actions,
}: {
  title: string;
  hint?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-heading font-semibold">{title}</h1>
        {hint ? <p className="mt-0.5 text-text-muted">{hint}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </header>
  );
}
