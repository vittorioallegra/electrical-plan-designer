import type { ComponentPropsWithRef, ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Tooltip } from './Tooltip';

export interface IconButtonProps extends Omit<ComponentPropsWithRef<'button'>, 'aria-label'> {
  /** Accessible name and tooltip text. */
  label: string;
  shortcut?: string;
  /** Where the tooltip opens; the default suits a bar, `right` a vertical rail. */
  tooltipSide?: 'top' | 'right' | 'bottom' | 'left';
  icon: ReactNode;
  pressed?: boolean;
  /** `lg` is the 32px tool rail size. */
  size?: 'md' | 'lg';
}

export function IconButton({
  label,
  shortcut,
  tooltipSide,
  icon,
  pressed,
  size = 'md',
  className,
  type = 'button',
  ...props
}: IconButtonProps) {
  return (
    <Tooltip label={label} shortcut={shortcut} {...(tooltipSide ? { side: tooltipSide } : {})}>
      <button
        type={type}
        aria-label={label}
        aria-pressed={pressed}
        className={cn(
          'inline-flex shrink-0 items-center justify-center rounded-sm text-text-muted transition-colors duration-[80ms] hover:bg-hover hover:text-text active:bg-pressed focus-visible:outline-2 focus-visible:outline-offset-1 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-transparent',
          size === 'lg' ? 'size-8' : 'size-7',
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
