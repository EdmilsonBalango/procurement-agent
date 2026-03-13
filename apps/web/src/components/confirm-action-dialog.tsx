import type { ReactNode } from 'react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  VisuallyHidden,
} from '@procurement/ui';

type ConfirmActionDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  onConfirm: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  loadingLabel?: string;
  disabled?: boolean;
  srTitle?: string;
};

export function ConfirmActionDialog({
  open,
  onOpenChange,
  title,
  description,
  onConfirm,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  loading = false,
  loadingLabel,
  disabled = false,
  srTitle,
}: ConfirmActionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !loading && onOpenChange(nextOpen)}>
      <DialogContent className="motion-modal w-full max-w-md">
        <DialogTitle>
          <VisuallyHidden>{srTitle ?? title}</VisuallyHidden>
        </DialogTitle>
        <h3 className="text-lg font-semibold text-heading">{title}</h3>
        <div className="mt-2 text-sm text-muted">{description}</div>
        <div className="mt-6 flex gap-3">
          <Button
            variant="secondary"
            full
            disabled={disabled || loading}
            onClick={() => onOpenChange(false)}
          >
            {cancelLabel}
          </Button>
          <Button full disabled={disabled || loading} onClick={onConfirm}>
            {loading ? loadingLabel ?? confirmLabel : confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
