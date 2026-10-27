import * as RadixSelect from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/cn';
import { fieldBox } from './TextField';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps {
  options: SelectOption[];
  value: string;
  onValueChange: (value: string) => void;
  id?: string;
  'aria-label'?: string;
  disabled?: boolean;
  invalid?: boolean;
  placeholder?: string;
  className?: string;
}

// Radix reserves the empty string for "no selection", so an option with value "" (a "None"
// choice) travels under a sentinel.
const EMPTY = '__empty__';
const toRadix = (v: string) => (v === '' ? EMPTY : v);
const fromRadix = (v: string) => (v === EMPTY ? '' : v);

/** Single-choice dropdown: same box as the text fields, options in a popover. */
export function Select({
  options,
  value,
  onValueChange,
  placeholder,
  invalid,
  className,
  id,
  disabled,
  ...aria
}: SelectProps) {
  return (
    <RadixSelect.Root
      value={toRadix(value)}
      onValueChange={(v) => onValueChange(fromRadix(v))}
      disabled={disabled}
    >
      <RadixSelect.Trigger
        id={id}
        aria-label={aria['aria-label']}
        aria-invalid={invalid || undefined}
        className={cn(
          fieldBox,
          'inline-flex w-full min-w-0 cursor-pointer items-center justify-between gap-2 text-left disabled:cursor-not-allowed disabled:opacity-45 data-[state=open]:border-focus',
          invalid ? 'border-error' : 'border-border',
          className,
        )}
      >
        <span className="truncate">
          <RadixSelect.Value placeholder={placeholder} />
        </span>
        <RadixSelect.Icon>
          <ChevronDown size={14} className="text-text-muted" aria-hidden />
        </RadixSelect.Icon>
      </RadixSelect.Trigger>
      <RadixSelect.Portal>
        <RadixSelect.Content
          position="popper"
          sideOffset={4}
          className="z-50 max-h-72 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-md border border-border bg-raised shadow-pop"
        >
          <RadixSelect.Viewport className="p-1">
            {options.map((o) => (
              <RadixSelect.Item
                key={o.value}
                value={toRadix(o.value)}
                disabled={o.disabled}
                className="relative flex h-7 cursor-pointer items-center rounded-sm pr-2 pl-6 text-body outline-none select-none data-[disabled]:opacity-45 data-[highlighted]:bg-hover"
              >
                <RadixSelect.ItemIndicator className="absolute left-1.5">
                  <Check size={14} className="text-accent-text" aria-hidden />
                </RadixSelect.ItemIndicator>
                <RadixSelect.ItemText>{o.label}</RadixSelect.ItemText>
              </RadixSelect.Item>
            ))}
          </RadixSelect.Viewport>
        </RadixSelect.Content>
      </RadixSelect.Portal>
    </RadixSelect.Root>
  );
}
