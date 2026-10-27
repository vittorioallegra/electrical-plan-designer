import * as RadixTabs from '@radix-ui/react-tabs';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

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
  variant = 'underline',
}: {
  tabs: TabDef[];
  value?: string;
  onValueChange?: (value: string) => void;
  className?: string;
  /** `underline` inside panels; `segmented` for top-level view switches. */
  variant?: 'underline' | 'segmented';
}) {
  const segmented = variant === 'segmented';
  return (
    <RadixTabs.Root
      value={value}
      defaultValue={value === undefined ? tabs[0]?.value : undefined}
      onValueChange={onValueChange}
      className={className}
    >
      {/* Sticky, so the tab bar stays reachable while a long tab scrolls its container. */}
      <RadixTabs.List
        className={cn(
          'sticky top-0 z-10 flex',
          segmented
            ? 'w-fit gap-0.5 rounded-sm bg-hover p-0.5'
            : 'gap-1 border-b border-border bg-panel',
        )}
      >
        {tabs.map((tab) => (
          <RadixTabs.Trigger
            key={tab.value}
            value={tab.value}
            className={cn(
              'text-small font-medium text-text-muted transition-colors duration-[80ms] hover:text-text focus-visible:outline-2',
              segmented
                ? 'h-6 rounded-xs px-2.5 data-[state=active]:bg-raised data-[state=active]:text-text data-[state=active]:shadow-[0_0_0_1px_var(--color-border)]'
                : '-mb-px border-b-2 border-transparent px-3 py-1.5 data-[state=active]:border-accent data-[state=active]:text-text',
            )}
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
