import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from './cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

const variants: Record<Variant, string> = {
  primary: 'bg-accent text-accent-contrast hover:bg-accent-hover',
  secondary: 'border border-border bg-surface hover:bg-surface-muted',
  ghost: 'hover:bg-surface-muted',
  danger: 'bg-error text-white hover:opacity-90',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', className, type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        'inline-flex h-[var(--control-height,2rem)] items-center justify-center gap-1.5 rounded px-[var(--control-padding-x,0.625rem)] font-medium disabled:cursor-not-allowed disabled:opacity-50',
        variants[variant],
        className,
      )}
      {...props}
    />
  );
});
