import React, { createContext, useContext, useState, useCallback } from "react";

export interface ToastItem {
  id: string;
  message: string;
  type?: "success" | "info" | "warning";
  undoAction?: () => void;
  undoLabel?: string;
}

export interface ToastOptions {
  type?: "success" | "info" | "warning";
  variant?: string;
  title?: string;
  description?: string;
  undoAction?: () => void;
  undoLabel?: string;
}

export type ToastInput = string | {
  title?: string;
  description?: string;
  message?: string;
  variant?: string;
  type?: "success" | "info" | "warning";
};

interface ToastContextType {
  toasts: ToastItem[];
  showToast: (
    input: ToastInput,
    options?: ToastOptions | any,
    maybeVariant?: string
  ) => void;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (input: ToastInput, options?: ToastOptions | any, maybeVariant?: string) => {
      const id = "toast_" + Math.random().toString(36).substring(2, 9);
      let msg = "";
      let toastType: "success" | "info" | "warning" = "success";
      let undoAction: (() => void) | undefined;
      let undoLabel = "Undo";

      if (typeof input === "string") {
        msg = input;
        if (options && typeof options === "object") {
          toastType = options.type || (options.variant === "warn" || options.variant === "warning" ? "warning" : "success");
          undoAction = options.undoAction;
          undoLabel = options.undoLabel || "Undo";
        }
        if (typeof maybeVariant === "string") {
          toastType = maybeVariant === "warn" || maybeVariant === "warning" ? "warning" : "success";
        }
      } else if (input && typeof input === "object") {
        msg = input.title ? (input.description ? `${input.title}: ${input.description}` : input.title) : input.message || "";
        const v = input.variant || input.type;
        toastType = v === "warn" || v === "warning" ? "warning" : "success";
      }

      const newToast: ToastItem = {
        id,
        message: msg,
        type: toastType,
        undoAction,
        undoLabel,
      };

      setToasts((prev) => [...prev, newToast]);

      // Auto dismiss after 4 seconds per UI Contract
      setTimeout(() => {
        dismissToast(id);
      }, 4000);
    },
    [dismissToast]
  );

  return (
    <ToastContext.Provider value={{ toasts, showToast, dismissToast }}>
      {children}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used within ToastProvider");
  return context;
}
