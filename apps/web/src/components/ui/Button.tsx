import type { ComponentPropsWithRef, ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'ghost-muted' | 'danger-ghost';
type Size = 'sm' | 'md' | 'lg' | 'fill';

const variants: Record<Variant, string> = {
  primary: 'bg-accent text-on-accent hover:bg-accent-hover active:bg-accent-hover',
  secondary: 'border border-border-strong bg-panel text-text hover:bg-hover active:bg-pressed',
  ghost: 'text-text hover:bg-hover active:bg-pressed',
  /** Quiet chrome (status bar, floating panels): muted at rest, full text colour on hover. */
  'ghost-muted': 'text-text-muted hover:bg-hover hover:text-text active:bg-pressed',
  'danger-ghost': 'text-error hover:bg-error-subtle active:bg-error-subtle',
};

const sizes: Record<Size, string> = {
  sm: 'h-6 gap-1 px-2 text-small',
  md: 'h-[var(--control-height,1.75rem)] gap-1.5 px-[var(--control-padding-x,0.75rem)] text-body',
  lg: 'h-9 gap-2 px-4 text-body',
  // Height, padding and text size come from the caller (a block that fills its parent).
  fill: 'gap-1',
};

export interface ButtonProps extends ComponentPropsWithRef<'button'> {
  variant?: Variant;
  size?: Size;
  /** Leading icon; decorative, the label stays the accessible name. */
  icon?: ReactNode;
  /** Toggle state: sets `aria-pressed` and fills the button with the accent tint. */
  pressed?: boolean;
}

export function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  pressed,
  className,
  type = 'button',
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      aria-pressed={pressed}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-sm font-medium whitespace-nowrap transition-colors duration-[80ms] focus-visible:outline-2 focus-visible:outline-offset-1 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-transparent',
        pressed ? 'bg-accent-subtle text-accent-text' : variants[variant],
        variant === 'primary' && 'disabled:hover:bg-accent',
        variant === 'secondary' && 'disabled:hover:bg-panel',
        sizes[size],
        className,
      )}
      {...props}
    >
      {icon ? (
        <span aria-hidden className="inline-flex shrink-0">
          {icon}
        </span>
      ) : null}
      {children}
    </button>
  );
}
