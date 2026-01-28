import * as React from 'react';
import { cn } from '../utils';

export const Breadcrumb = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <nav
    ref={ref}
    aria-label="Breadcrumb"
    className={cn('text-sm text-slate-500', className)}
    {...props}
  />
));

Breadcrumb.displayName = 'Breadcrumb';

export const BreadcrumbList = React.forwardRef<
  HTMLOListElement,
  React.OlHTMLAttributes<HTMLOListElement>
>(({ className, ...props }, ref) => (
  <ol
    ref={ref}
    className={cn('flex flex-wrap items-center gap-2', className)}
    {...props}
  />
));

BreadcrumbList.displayName = 'BreadcrumbList';

export const BreadcrumbItem = React.forwardRef<
  HTMLLIElement,
  React.LiHTMLAttributes<HTMLLIElement>
>(({ className, ...props }, ref) => (
  <li ref={ref} className={cn('flex items-center gap-2', className)} {...props} />
));

BreadcrumbItem.displayName = 'BreadcrumbItem';

export const BreadcrumbSeparator = React.forwardRef<
  HTMLSpanElement,
  React.HTMLAttributes<HTMLSpanElement>
>(({ className, ...props }, ref) => (
  <span
    ref={ref}
    aria-hidden="true"
    className={cn('text-slate-300', className)}
    {...props}
  >
    /
  </span>
));

BreadcrumbSeparator.displayName = 'BreadcrumbSeparator';

export const BreadcrumbLink = React.forwardRef<
  HTMLAnchorElement,
  React.AnchorHTMLAttributes<HTMLAnchorElement>
>(({ className, ...props }, ref) => (
  <a
    ref={ref}
    className={cn('text-slate-500 transition-colors hover:text-slate-700', className)}
    {...props}
  />
));

BreadcrumbLink.displayName = 'BreadcrumbLink';

export const BreadcrumbPage = React.forwardRef<
  HTMLSpanElement,
  React.HTMLAttributes<HTMLSpanElement>
>(({ className, ...props }, ref) => (
  <span
    ref={ref}
    aria-current="page"
    className={cn('font-medium text-slate-800', className)}
    {...props}
  />
));

BreadcrumbPage.displayName = 'BreadcrumbPage';
