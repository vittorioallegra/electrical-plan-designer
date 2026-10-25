import * as RadixTabs from '@radix-ui/react-tabs';
import type { ReactNode } from 'react';

export interface TabDef {
  value: string;
  label: ReactNode;
  content: ReactNode;
}

export function Tabs({
  tabs,
  value,
  onValueChange,
  className,
}: {
  tabs: TabDef[];
  value?: string;
  onValueChange?: (value: string) => void;
  className?: string;
}) {
  return (
    <RadixTabs.Root
      value={value}
      defaultValue={value === undefined ? tabs[0]?.value : undefined}
      onValueChange={onValueChange}
      className={className}
    >
      <RadixTabs.List className="flex gap-1 border-b border-border">
        {tabs.map((tab) => (
          <RadixTabs.Trigger
            key={tab.value}
            value={tab.value}
            className="-mb-px border-b-2 border-transparent px-3 py-1.5 text-text-muted data-[state=active]:border-accent data-[state=active]:text-text"
          >
            {tab.label}
          </RadixTabs.Trigger>
        ))}
      </RadixTabs.List>
      {tabs.map((tab) => (
        <RadixTabs.Content key={tab.value} value={tab.value} className="py-2">
          {tab.content}
        </RadixTabs.Content>
      ))}
    </RadixTabs.Root>
  );
}
