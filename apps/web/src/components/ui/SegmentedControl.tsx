import * as ToggleGroup from '@radix-ui/react-toggle-group';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface SegmentOption {
  value: string;
  label: ReactNode;
  /** Accessible name when the label is an icon. */
  ariaLabel?: string;
}

export interface SegmentedControlProps {
  options: SegmentOption[];
  value: string;
  onValueChange: (value: string) => void;
  'aria-label': string;
  disabled?: boolean;
  className?: string;
}

/** 2-5 exclusive options. A selected segment cannot be unselected. */
export function SegmentedControl({
  options,
  value,
  onValueChange,
  disabled,
  className,
  ...aria
}: SegmentedControlProps) {
  return (
    <ToggleGroup.Root
      type="single"
      value={value}
      disabled={disabled}
      aria-label={aria['aria-label']}
      onValueChange={(v) => {
        if (v) onValueChange(v);
      }}
      className={cn('inline-flex rounded-sm bg-hover p-0.5', className)}
    >
      {options.map((o) => (
        <ToggleGroup.Item
          key={o.value}
          value={o.value}
          aria-label={o.ariaLabel}
          className="inline-flex h-6 shrink-0 items-center justify-center gap-1 rounded-xs px-2.5 whitespace-nowrap text-small font-medium text-text-muted transition-colors duration-[80ms] hover:text-text focus-visible:outline-2 disabled:cursor-not-allowed disabled:opacity-45 data-[state=on]:bg-raised data-[state=on]:text-text data-[state=on]:shadow-[0_0_0_1px_var(--color-border)]"
        >
          {o.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}
