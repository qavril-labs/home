import React, { useEffect, useRef } from "react";
import { cn } from "../../lib/utils";
import { Button } from "./Button";
import { X } from "lucide-react";

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  primaryActionLabel?: string;
  primaryActionVariant?: "lime" | "yellow" | "pink" | "violet" | "cyan" | "dark";
  onPrimaryAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  isSubmitting?: boolean;
  maxWidth?: string;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  primaryActionLabel,
  primaryActionVariant = "lime",
  onPrimaryAction,
  secondaryActionLabel = "Cancel",
  onSecondaryAction,
  isSubmitting = false,
  maxWidth = "max-w-[560px]",
}) => {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isSubmitting) {
        onClose();
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    // Focus inside modal
    const focusable = modalRef.current?.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable && focusable.length > 0) {
      (focusable[0] as HTMLElement).focus();
    }

    return () => {
      document.body.style.overflow = "unset";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/60 backdrop-blur-sm transition-opacity duration-180"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) {
          onClose();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        ref={modalRef}
        className={cn(
          "w-full bg-panel border-line shadow-card p-6 relative transition-transform duration-180",
          maxWidth
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-4 pb-3 border-b-line">
          <div>
            <h2
              id="modal-title"
              className="font-display font-extrabold text-xl uppercase tracking-tight text-text leading-tight"
            >
              {title}
            </h2>
            {description && (
              <p className="text-xs text-muted mt-1 leading-normal">{description}</p>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Close dialog"
            className="w-8 h-8 flex items-center justify-center bg-page border-line shadow-[2px_2px_0_var(--q-ink)] hover:bg-cream text-ink cursor-pointer active:translate-y-0.5"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content body */}
        <div className="my-4">{children}</div>

        {/* Footer Actions */}
        {(primaryActionLabel || secondaryActionLabel) && (
          <div className="mt-6 pt-4 border-t border-grid flex items-center justify-end gap-3">
            {secondaryActionLabel && (
              <Button
                variant="ghost"
                size="md"
                onClick={onSecondaryAction || onClose}
                disabled={isSubmitting}
              >
                {secondaryActionLabel}
              </Button>
            )}

            {primaryActionLabel && onPrimaryAction && (
              <Button
                variant={primaryActionVariant}
                size="md"
                onClick={onPrimaryAction}
                disabled={isSubmitting}
              >
                {isSubmitting ? "Processing…" : primaryActionLabel}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
