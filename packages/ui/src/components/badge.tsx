import * as React from 'react';
import { cn } from '../utils';
import { getStatusColors } from '../utils/status-colors';

const fallbackColors = {
  bg: 'bg-slate-50',
  text: 'text-slate-600',
  border: 'border-slate-200',
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'case' | 'priority' | 'checklist' | 'severity' | 'role';
  statusType?: 'case' | 'priority' | 'checklist' | 'severity' | 'role';
  status?: string;
}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = 'default', statusType, status, children, ...props }, ref) => {
    let baseClasses =
      'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium';

    // If status-based coloring is requested
    if (variant !== 'default' && status) {
      const colors = getStatusColors(status, statusType || variant) ?? fallbackColors;
      return (
        <span
          ref={ref}
          className={cn(baseClasses, colors.bg, colors.text, colors.border, className)}
          {...props}
        >
          {children || status}
        </span>
      );
    }

    // Default styling
    return (
      <span
        ref={ref}
        className={cn(
          baseClasses,
          'border-slate-200 bg-slate-50 text-slate-600',
          className,
        )}
        {...props}
      >
        {children}
      </span>
    );
  },
);

Badge.displayName = 'Badge';
