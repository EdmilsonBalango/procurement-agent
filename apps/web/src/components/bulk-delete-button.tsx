import type { ComponentProps } from 'react';
import { Button } from '@procurement/ui';
import { Trash2 } from 'lucide-react';

type BulkDeleteButtonProps = Omit<ComponentProps<typeof Button>, 'children' | 'size' | 'variant'> & {
  count: number;
  loading?: boolean;
};

export function BulkDeleteButton({
  count,
  loading = false,
  className = '',
  ...props
}: BulkDeleteButtonProps) {
  return (
    <Button
      size="sm"
      variant="secondary"
      className={`text-red-500 hover:bg-red-50 hover:text-red-600 ${className}`.trim()}
      {...props}
    >
      <Trash2 className="h-4 w-4 mr-2" />
      {loading ? 'Deleting...' : `Delete selected (${count})`}
    </Button>
  );
}
