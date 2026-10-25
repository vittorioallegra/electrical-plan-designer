import { useId, type InputHTMLAttributes } from 'react';
import { cn } from './cn';

export function TextField({
  label,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const id = useId();
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <label htmlFor={props.id ?? id}>{label}</label>
      <input
        id={props.id ?? id}
        className="h-[var(--control-height,2rem)] rounded border border-border bg-surface px-2"
        {...props}
      />
    </div>
  );
}
