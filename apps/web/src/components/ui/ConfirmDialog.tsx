import React from "react";
import { Modal } from "./Modal";
import { AlertTriangle } from "lucide-react";

export interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  actionVerb: string; // e.g. "Post $1,250.00", "Delete Contact", "Reverse Entry"
  actionVariant?: "lime" | "pink" | "yellow" | "dark";
  onConfirm: () => void;
  isSubmitting?: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  title,
  message,
  actionVerb,
  actionVariant = "pink",
  onConfirm,
  isSubmitting = false,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      primaryActionLabel={actionVerb}
      primaryActionVariant={actionVariant}
      onPrimaryAction={onConfirm}
      secondaryActionLabel="Cancel"
      onSecondaryAction={onClose}
      isSubmitting={isSubmitting}
      maxWidth="max-w-[480px]"
    >
      <div className="flex items-start gap-4 py-2">
        <div className="w-12 h-12 bg-[#fff4dc] border-line shadow-sm flex items-center justify-center flex-shrink-0 text-watch">
          <AlertTriangle className="w-6 h-6 text-act" />
        </div>
        <div className="text-sm text-text leading-relaxed font-medium">
          {message}
        </div>
      </div>
    </Modal>
  );
};
