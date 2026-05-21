'use client';

import * as React from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { cn } from '@/components/ui/utils';

const sizeClasses: Record<string, string> = {
  default: 'sm:max-w-lg',
  lg: 'sm:max-w-3xl',
  xl: 'sm:max-w-5xl',
};

const shellBase = cn(
  'gap-0 p-0',
  'relative w-full max-h-[min(92vh,880px)] max-w-[calc(100vw-1rem)] overflow-hidden rounded-[var(--cp-radius-xl)]',
  '!flex flex-col min-h-0 shadow-[var(--cp-shadow-lg)]',
  '[&>button]:border-0 [&>button]:opacity-70 [&>button]:text-[var(--cp-text-muted)] [&>button]:hover:text-[var(--cp-text-primary)] [&>button]:hover:opacity-100',
);

type CareerDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  /** Extra classes merged onto Radix content (e.g. wider job drawer). */
  contentClassName?: string;
  /** Block dismiss via overlay / Escape (e.g. while a mutation is in flight). */
  preventClose?: boolean;
  /** Dialog width preset. default = max-w-lg, lg = max-w-3xl, xl = max-w-5xl */
  size?: 'default' | 'lg' | 'xl';
};

/**
 * Radix Dialog with focus trap + ElevateX shell (centered by shared DialogContent layout).
 */
export function CareerDialog({ open, onOpenChange, children, contentClassName, preventClose, size = 'default' }: CareerDialogProps) {
  const shell = cn(shellBase, sizeClasses[size]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(shell, contentClassName)}
        style={{
          background: 'var(--modal)',
          border: '1px solid var(--cp-border-strong)',
          color: 'var(--cp-text-primary)',
          boxShadow: 'var(--cp-elevation-4)',
        }}
        onPointerDownOutside={e => {
          if (preventClose) e.preventDefault();
        }}
        onEscapeKeyDown={e => {
          if (preventClose) e.preventDefault();
        }}
      >
        <div
          className="max-h-[min(85vh,800px)] min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-6 pt-10 sm:pt-12"
          style={{ color: 'var(--cp-text-primary)' }}
        >
          {children}
        </div>
      </DialogContent>
    </Dialog>
  );
}
