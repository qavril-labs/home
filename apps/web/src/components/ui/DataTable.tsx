import React, { useState, useEffect } from "react";
import { cn } from "../../lib/utils";
import { EmptyState } from "./EmptyState";

export interface Column<T> {
  header: string;
  accessorKey?: keyof T;
  align?: "left" | "center" | "right";
  cell?: (row: T) => React.ReactNode;
  width?: string;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  emptyTitle?: string;
  emptyDescription?: string;
  onEmptyAction?: () => void;
  emptyActionLabel?: string;
  className?: string;
  enableVimNavigation?: boolean;
  onRowSelect?: (row: T) => void;
  onRowAction?: (action: "edit" | "delete" | "view", row: T) => void;
}

export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  emptyTitle = "No records found",
  emptyDescription = "No data is available yet for this view.",
  onEmptyAction,
  emptyActionLabel,
  className,
  enableVimNavigation = true,
  onRowSelect,
  onRowAction,
}: DataTableProps<T>) {
  const [selectedIndex, setSelectedIndex] = useState<number>(0);

  // Vim keyboard navigation: j (down), k (up), Enter (select), e (edit), x (delete)
  useEffect(() => {
    if (!enableVimNavigation || data.length === 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept when user is typing inside input, textarea, or contentEditable
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, data.length - 1));
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (data[selectedIndex]) {
          onRowSelect?.(data[selectedIndex]);
        }
      } else if (e.key === "e") {
        e.preventDefault();
        if (data[selectedIndex]) {
          onRowAction?.("edit", data[selectedIndex]);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enableVimNavigation, data, selectedIndex, onRowSelect, onRowAction]);

  if (data.length === 0) {
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
        onAction={onEmptyAction}
        actionLabel={emptyActionLabel}
      />
    );
  }

  return (
    <div className={cn("neo-table-wrapper border-line relative", className)}>
      {/* Keyboard hotkey hint badge */}
      {enableVimNavigation && data.length > 0 && (
        <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 bg-page border-b border-grid text-[10px] font-mono text-muted">
          <span className="font-bold text-text">Speedrun Hotkeys:</span>
          <kbd className="px-1 bg-panel border border-ink text-text">j</kbd>
          <span>down</span>
          <kbd className="px-1 bg-panel border border-ink text-text">k</kbd>
          <span>up</span>
          <kbd className="px-1 bg-panel border border-ink text-text">Enter</kbd>
          <span>open</span>
          <kbd className="px-1 bg-panel border border-ink text-text">e</kbd>
          <span>edit</span>
        </div>
      )}

      <table className="neo-table">
        <thead>
          <tr>
            {columns.map((col, idx) => (
              <th
                key={idx}
                scope="col"
                style={{ width: col.width }}
                className={cn(
                  col.align === "right"
                    ? "text-right"
                    : col.align === "center"
                    ? "text-center"
                    : "text-left"
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, rIdx) => {
            const isSelected = enableVimNavigation && selectedIndex === rIdx;
            return (
              <tr
                key={rIdx}
                onClick={() => {
                  setSelectedIndex(rIdx);
                  onRowSelect?.(row);
                }}
                className={cn(
                  "cursor-pointer transition-colors",
                  isSelected
                    ? "bg-yellow/30 font-bold border-l-4 border-l-ink"
                    : "hover:bg-grid/40"
                )}
              >
                {columns.map((col, cIdx) => (
                  <td
                    key={cIdx}
                    className={cn(
                      col.align === "right"
                        ? "text-right font-mono"
                        : col.align === "center"
                        ? "text-center"
                        : "text-left"
                    )}
                  >
                    {col.cell
                      ? col.cell(row)
                      : col.accessorKey
                      ? String(row[col.accessorKey] ?? "")
                      : null}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
