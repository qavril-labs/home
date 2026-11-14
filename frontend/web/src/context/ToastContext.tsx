import React, { createContext, useContext, useState, useCallback } from "react";

export interface ToastItem {
  id: string;
  message: string;
  type?: "success" | "info" | "warning";
  undoAction?: () => void;
  undoLabel?: string;
}

interface ToastContextType {
  toasts: ToastItem[];
  showToast: (message: string, options?: { type?: "success" | "info" | "warning"; undoAction?: () => void; undoLabel?: string }) => void;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, options?: { type?: "success" | "info" | "warning"; undoAction?: () => void; undoLabel?: string }) => {
      const id = "toast_" + Math.random().toString(36).substring(2, 9);
      const newToast: ToastItem = {
        id,
        message,
        type: options?.type || "success",
        undoAction: options?.undoAction,
        undoLabel: options?.undoLabel || "Undo",
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
