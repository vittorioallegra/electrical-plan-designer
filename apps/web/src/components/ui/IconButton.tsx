import type { ComponentPropsWithRef, ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Tooltip } from './Tooltip';

export interface IconButtonProps extends Omit<ComponentPropsWithRef<'button'>, 'aria-label'> {
  /** Accessible name and tooltip text. */
  label: string;
  shortcut?: string;
  icon: ReactNode;
  pressed?: boolean;
}

export function IconButton({
  label,
  shortcut,
  icon,
  pressed,
  className,
  type = 'button',
  ...props
}: IconButtonProps) {
  return (
    <Tooltip label={label} shortcut={shortcut}>
      <button
        type={type}
        aria-label={label}
        aria-pressed={pressed}
        className={cn(
          'inline-flex size-7 shrink-0 items-center justify-center rounded-sm text-text-muted transition-colors duration-[80ms] hover:bg-hover hover:text-text active:bg-pressed focus-visible:outline-2 focus-visible:outline-offset-1 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-transparent',
          pressed && 'bg-accent-subtle text-accent-text',
          className,
        )}
        {...props}
      >
        <span aria-hidden className="inline-flex">
          {icon}
        </span>
      </button>
    </Tooltip>
  );
}
