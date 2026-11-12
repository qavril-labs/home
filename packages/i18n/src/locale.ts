import { DomainError } from "@erp/kernel";
import { Money, getCurrency } from "@erp/money";

/** Languages written right to left. Used to set the page direction in the UI. */
const RTL_LANGUAGES = new Set(["ar", "fa", "he", "ps", "sd", "ug", "ur", "yi"]);

export function textDirection(locale: string): "ltr" | "rtl" {
  const language = locale.trim().toLowerCase().split(/[-_]/)[0] ?? "";
  return RTL_LANGUAGES.has(language) ? "rtl" : "ltr";
}

/**
 * Formats money for display. Display only: never parse the output back into an amount.
 * Uses Intl, which handles grouping, symbols, and digit systems per locale.
 */
export function formatMoney(money: Money, locale: string): string {
  const { minorUnits } = getCurrency(money.currency);
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: money.currency,
    minimumFractionDigits: minorUnits,
    maximumFractionDigits: minorUnits,
  }).format(Number(money.toDecimal()));
}

/** Formats a business date (YYYY-MM-DD) without shifting it across time zones. */
export function formatDate(isoDate: string, locale: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    throw new DomainError("VALIDATION", `Expected a YYYY-MM-DD date, got ${isoDate}`);
  }
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }).format(
    new Date(`${isoDate}T00:00:00Z`),
  );
}
