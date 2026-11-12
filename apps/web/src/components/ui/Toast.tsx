import React from "react";
import { useToast } from "../../context/ToastContext";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

export const ToastContainer: React.FC = () => {
  const { toasts, dismissToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm pointer-events-none"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="pointer-events-auto flex items-center justify-between gap-3 bg-panel border-line shadow-card p-3 text-xs font-bold text-text transition-all duration-180 animate-in slide-in-from-bottom"
        >
          <div className="flex items-center gap-2">
            {toast.type === "warning" ? (
              <AlertCircle className="w-4 h-4 text-watch flex-shrink-0" />
            ) : toast.type === "info" ? (
              <Info className="w-4 h-4 text-cyan flex-shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-good flex-shrink-0" />
            )}
            <span className="leading-tight">{toast.message}</span>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {toast.undoAction && (
              <button
                type="button"
                onClick={() => {
                  toast.undoAction?.();
                  dismissToast(toast.id);
                }}
                className="text-pink hover:underline uppercase text-[11px] font-extrabold cursor-pointer"
              >
                {toast.undoLabel || "Undo"}
              </button>
            )}

            <button
              type="button"
              onClick={() => dismissToast(toast.id)}
              aria-label="Dismiss toast"
              className="text-muted hover:text-text cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};
