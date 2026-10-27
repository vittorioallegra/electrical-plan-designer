import * as RadixDialog from '@radix-ui/react-dialog';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children?: ReactNode;
  /** Ghost cancel on the left of one primary action. */
  footer?: ReactNode;
  /** Wider dialog for tables and diffs. */
  wide?: boolean;
}

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  wide,
}: DialogProps) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        {/* Above sticky bars (z-10); below toasts (z-50). */}
        <RadixDialog.Overlay
          className="fixed inset-0 z-40 bg-black/40"
          data-testid="dialog-overlay"
        />
        <RadixDialog.Content
          className={cn(
            'fixed top-1/2 left-1/2 z-40 flex max-h-[calc(100vh-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-lg border border-border bg-raised p-5 shadow-dialog',
            wide ? 'w-[min(44rem,calc(100vw-2rem))]' : 'w-[min(32rem,calc(100vw-2rem))]',
          )}
        >
          <RadixDialog.Title className="text-heading font-semibold">{title}</RadixDialog.Title>
          {description ? (
            <RadixDialog.Description className="mt-1 text-text-muted">
              {description}
            </RadixDialog.Description>
          ) : (
            <RadixDialog.Description className="sr-only">{title}</RadixDialog.Description>
          )}
          {children ? <div className="mt-4 min-h-0 overflow-y-auto">{children}</div> : null}
          {footer ? <div className="mt-5 flex justify-end gap-2">{footer}</div> : null}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
