import * as RadixMenu from '@radix-ui/react-dropdown-menu';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface MenuItem {
  key: string;
  label: string;
  onSelect: () => void;
  disabled?: boolean;
  danger?: boolean;
  /** Shortcut hint on the right, e.g. "Cmd+S". */
  shortcut?: string;
  /** Hairline above this item. */
  separatorBefore?: boolean;
}

export function Menu({ trigger, items }: { trigger: ReactNode; items: MenuItem[] }) {
  return (
    <RadixMenu.Root>
      <RadixMenu.Trigger asChild>{trigger}</RadixMenu.Trigger>
      <RadixMenu.Portal>
        <RadixMenu.Content
          align="end"
          sideOffset={4}
          className="z-50 min-w-44 rounded-md border border-border bg-raised p-1 shadow-pop"
        >
          {items.map((item) => (
            <div key={item.key}>
              {item.separatorBefore ? (
                <RadixMenu.Separator className="my-1 h-px bg-border" />
              ) : null}
              <RadixMenu.Item
                disabled={item.disabled}
                onSelect={item.onSelect}
                className={cn(
                  'flex h-7 cursor-pointer items-center justify-between gap-6 rounded-sm px-2 text-body outline-none select-none data-[disabled]:opacity-45 data-[highlighted]:bg-hover',
                  item.danger && 'text-error',
                )}
              >
                {item.label}
                {item.shortcut ? (
                  <kbd className="font-mono text-label text-text-faint">{item.shortcut}</kbd>
                ) : null}
              </RadixMenu.Item>
            </div>
          ))}
        </RadixMenu.Content>
      </RadixMenu.Portal>
    </RadixMenu.Root>
  );
}
