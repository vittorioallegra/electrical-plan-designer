import * as RadixMenu from '@radix-ui/react-dropdown-menu';
import type { ReactNode } from 'react';

export interface MenuItem {
  key: string;
  label: string;
  onSelect: () => void;
  disabled?: boolean;
  danger?: boolean;
}

export function Menu({ trigger, items }: { trigger: ReactNode; items: MenuItem[] }) {
  return (
    <RadixMenu.Root>
      <RadixMenu.Trigger asChild>{trigger}</RadixMenu.Trigger>
      <RadixMenu.Portal>
        <RadixMenu.Content
          align="end"
          sideOffset={4}
          className="min-w-40 rounded border border-border bg-surface p-1 shadow-lg"
        >
          {items.map((item) => (
            <RadixMenu.Item
              key={item.key}
              disabled={item.disabled}
              onSelect={item.onSelect}
              className={`cursor-pointer rounded px-2 py-1.5 outline-none data-[disabled]:opacity-50 data-[highlighted]:bg-surface-muted ${item.danger ? 'text-error' : ''}`}
            >
              {item.label}
            </RadixMenu.Item>
          ))}
        </RadixMenu.Content>
      </RadixMenu.Portal>
    </RadixMenu.Root>
  );
}
