import * as React from 'react';
import { cn } from '../utils';

type TooltipProps = {
  content: React.ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
  align?: 'start' | 'center' | 'end';
} & React.HTMLAttributes<HTMLDivElement>;

const sideClasses: Record<NonNullable<TooltipProps['side']>, string> = {
  top: 'bottom-full mb-2',
  bottom: 'top-full mt-2',
  left: 'right-full mr-2',
  right: 'left-full ml-2',
};

const alignClasses: Record<NonNullable<TooltipProps['align']>, string> = {
  start: 'left-0',
  center: 'left-1/2 -translate-x-1/2',
  end: 'right-0',
};

export const Tooltip = ({
  content,
  side = 'top',
  align = 'center',
  className,
  children,
  ...props
}: TooltipProps) => (
  <div className={cn('relative inline-flex group', className)} {...props}>
    {children}
    <div
      role="tooltip"
      className={cn(
        'pointer-events-none absolute z-50 whitespace-nowrap rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200',
        sideClasses[side],
        alignClasses[align],
      )}
    >
      {content}
    </div>
  </div>
);
