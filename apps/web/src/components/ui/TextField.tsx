import { useId, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

// `field-box` (styles.css) draws the one focus ring of the box, also for an input inside it.
export const fieldBox =
  'field-box h-[var(--control-height,1.75rem)] rounded-sm border bg-chrome px-2 text-body text-text transition-colors duration-[80ms] placeholder:text-text-faint';

export function TextField({
  label,
  className,
  error,
  unit,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  /** Message shown below the field; also marks it invalid. */
  error?: string | undefined;
  unit?: string | undefined;
}) {
  const id = useId();
  const inputId = props.id ?? id;
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <label htmlFor={inputId} className="text-small text-text-muted">
        {label}
      </label>
      <span className={cn(fieldBox, 'flex items-center', error ? 'border-error' : 'border-border')}>
        <input
          {...props}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${inputId}-error` : undefined}
          className="min-w-0 flex-1 bg-transparent outline-none disabled:cursor-not-allowed disabled:opacity-45"
        />
        {unit ? <span className="ml-1 text-text-faint">{unit}</span> : null}
      </span>
      {error ? (
        <p id={`${inputId}-error`} className="text-small text-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
