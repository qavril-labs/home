import React from "react";
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
}

export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  emptyTitle = "No records found",
  emptyDescription = "No data is available yet for this view.",
  onEmptyAction,
  emptyActionLabel,
  className,
}: DataTableProps<T>) {
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
    <div className={cn("neo-table-wrapper border-line", className)}>
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
          {data.map((row, rIdx) => (
            <tr key={rIdx}>
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
          ))}
        </tbody>
      </table>
    </div>
  );
}
