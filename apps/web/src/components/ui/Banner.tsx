import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type BannerTone = 'info' | 'warning';

const tones: Record<BannerTone, string> = {
  info: 'bg-accent-subtle text-accent-text',
  warning: 'bg-warning-subtle text-warning',
};

/** Full-width notice under the title bar; an optional action (e.g. Dismiss) sits on the right. */
export function Banner({
  tone = 'info',
  action,
  children,
}: {
  tone?: BannerTone;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      role="status"
      className={cn(
        'flex min-h-8 shrink-0 items-center gap-3 border-b border-border px-3 py-1 text-small',
        tones[tone],
      )}
    >
      <span className="min-w-0 flex-1">{children}</span>
      {action}
    </div>
  );
}
