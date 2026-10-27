import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/** One sentence plus the one action that fixes it. */
export function EmptyState({
  message,
  action,
  className,
}: {
  message: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center gap-3 px-4 py-10 text-center', className)}>
      <p className="max-w-prose text-text-muted">{message}</p>
      {action}
    </div>
  );
}
