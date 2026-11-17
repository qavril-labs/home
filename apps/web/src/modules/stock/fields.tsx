import React from "react";
import { cn } from "../../lib/utils";

/** The one input style the stock and till forms share, drawn from the design tokens. */
export const fieldClass =
  "w-full bg-page text-text border-line border-thin px-3 py-2 font-body text-sm placeholder:text-muted disabled:opacity-60";

export const Field: React.FC<{
  label: string;
  hint?: string;
  error?: string | null;
  className?: string;
  children: React.ReactNode;
}> = ({ label, hint, error, className, children }) => (
  <label className={cn("flex flex-col gap-1", className)}>
    <span className="text-[11px] font-black uppercase text-muted">{label}</span>
    {children}
    {error ? (
      <span className="text-xs font-bold text-pink" role="alert">
        {error}
      </span>
    ) : hint ? (
      <span className="text-xs text-muted">{hint}</span>
    ) : null}
  </label>
);

/** A whole-number field: digits only, so no float can reach the API. */
export function digitsOnly(value: string): string {
  return value.replace(/[^0-9]/g, "");
}

/** A money amount typed by hand: digits and at most one decimal point. The server checks the decimal places. */
export function amountText(value: string): string {
  const cleaned = value.replace(/[^0-9.]/g, "");
  const [whole = "", ...rest] = cleaned.split(".");
  return rest.length > 0 ? `${whole}.${rest.join("")}` : whole;
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong. Nothing was changed.";
}
