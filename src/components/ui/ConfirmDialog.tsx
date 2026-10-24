import { AlertTriangle, type LucideIcon } from 'lucide-react';
import { Popup, type PopupTone } from './Popup';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  icon?: LucideIcon;
  tone?: PopupTone;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  icon = AlertTriangle,
  tone = 'danger',
  onConfirm,
  onClose
}: ConfirmDialogProps) {
  return (
    <Popup
      open={open}
      onClose={onClose}
      icon={icon}
      tone={tone}
      eyebrow="Please confirm"
      title={title}
      primary={{
        label: confirmLabel,
        variant: tone === 'danger' ? 'danger' : 'primary',
        onClick: () => {
          onConfirm();
          onClose();
        }
      }}
      secondary={{ label: cancelLabel, onClick: onClose }}
    >
      {description}
    </Popup>
  );
}
