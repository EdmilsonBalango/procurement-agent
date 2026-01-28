import * as React from 'react';
import { cn } from '../utils';

export const Table = ({ className, ...props }: React.HTMLAttributes<HTMLTableElement>) => (
  <div className="w-full overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
    <table className={cn('w-full text-sm', className)} {...props} />
  </div>
);

export const TableHeader = ({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) => (
  <thead className={cn('bg-slate-50 text-slate-600 dark:bg-slate-900 dark:text-slate-300', className)} {...props} />
);

export const TableRow = ({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) => (
  <tr
    className={cn('border-b border-slate-100 last:border-b-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900', className)}
    {...props}
  />
);

export const TableHead = ({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) => (
  <th className={cn('px-4 py-3 text-left font-medium', className)} {...props} />
);

export const TableCell = ({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) => (
  <td className={cn('px-4 py-3 text-slate-700 dark:text-slate-200', className)} {...props} />
);
