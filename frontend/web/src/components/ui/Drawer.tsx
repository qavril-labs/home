import React, { useEffect, useRef } from "react";
import { cn } from "../../lib/utils";
import { Button } from "./Button";
import { X } from "lucide-react";

export interface DrawerProps {
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
}

export const Drawer: React.FC<DrawerProps> = ({
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
}) => {
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isSubmitting) {
        onClose();
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    // Focus inside drawer
    const focusable = drawerRef.current?.querySelectorAll(
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
      className="fixed inset-0 z-50 flex justify-end bg-ink/60 backdrop-blur-sm transition-opacity duration-180"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) {
          onClose();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="drawer-title"
    >
      <div
        ref={drawerRef}
        className={cn(
          "w-full min-[520px]:max-w-[480px] h-full bg-panel border-l-0 min-[520px]:border-l-line shadow-card flex flex-col justify-between transform transition-transform duration-180 animate-in slide-in-from-right"
        )}
      >
        {/* Drawer Header */}
        <div className="p-6 border-b-line flex items-start justify-between gap-4 bg-page">
          <div>
            <h2
              id="drawer-title"
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
            aria-label="Close drawer"
            className="w-8 h-8 flex items-center justify-center bg-panel border-line shadow-[2px_2px_0_var(--q-ink)] hover:bg-cream text-ink cursor-pointer active:translate-y-0.5 flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Form Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">{children}</div>

        {/* Drawer Footer Actions */}
        {(primaryActionLabel || secondaryActionLabel) && (
          <div className="p-4 border-t-line bg-page flex items-center justify-end gap-3">
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
                {isSubmitting ? "Saving…" : primaryActionLabel}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
