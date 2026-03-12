import type { ComponentProps } from 'react';
import { Button } from '@procurement/ui';
import { Pencil, Trash2 } from 'lucide-react';

type TableActionButtonProps = Omit<ComponentProps<typeof Button>, 'children' | 'size' | 'variant'> & {
  action: 'edit' | 'delete';
};

const config = {
  edit: {
    label: 'Edit',
    icon: Pencil,
    className: '',
  },
  delete: {
    label: 'Delete',
    icon: Trash2,
    className: 'text-red-500 hover:bg-red-50 hover:text-red-600',
  },
} as const;

export function TableActionButton({ action, className = '', ...props }: TableActionButtonProps) {
  const { label, icon: Icon, className: actionClassName } = config[action];

  return (
    <Button
      size="sm"
      variant="secondary"
      aria-label={label}
      className={`h-9 w-9 p-0 ${actionClassName} ${className}`.trim()}
      {...props}
    >
      <Icon className="h-4 w-4" />
    </Button>
  );
}
