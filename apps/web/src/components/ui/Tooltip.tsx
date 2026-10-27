import * as RadixTooltip from '@radix-ui/react-tooltip';
import type { ReactNode } from 'react';

export interface TooltipProps {
  label: string;
  /** Keyboard shortcut shown next to the label, e.g. "Cmd+Z". */
  shortcut?: string | undefined;
  side?: 'top' | 'right' | 'bottom' | 'left';
  children: ReactNode;
}

/** Hover/focus tip for the single child element (which must accept a ref). */
export function Tooltip({ label, shortcut, side = 'bottom', children }: TooltipProps) {
  return (
    <RadixTooltip.Provider delayDuration={400} skipDelayDuration={200}>
      <RadixTooltip.Root>
        <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
        <RadixTooltip.Portal>
          <RadixTooltip.Content
            side={side}
            sideOffset={6}
            className="z-50 flex items-center gap-2 rounded-sm bg-text px-2 py-1 text-small text-panel shadow-pop"
          >
            {label}
            {shortcut ? <kbd className="font-mono text-label opacity-70">{shortcut}</kbd> : null}
          </RadixTooltip.Content>
        </RadixTooltip.Portal>
      </RadixTooltip.Root>
    </RadixTooltip.Provider>
  );
}
