import { formatMoney } from "./currency";
import type { Amount } from "./live-api";

const SYMBOLS: Record<string, string> = { USD: "$", EUR: "€", GBP: "£", JPY: "¥" };

/** The symbol shown before an amount. Unknown currencies show their three-letter code instead. */
export function currencySymbol(currency: string): string {
  return SYMBOLS[currency] ?? `${currency} `;
}

/** Formats an amount the API returned, such as $1,234.50. Null shows as a dash, not as zero. */
export function formatAmount(value: Amount | null | undefined): string {
  if (!value) return "—";
  return formatMoney(value.amount, currencySymbol(value.currency));
}

/** Whole units as the API sends them, with thousands separators. */
export function formatQuantity(value: string): string {
  return value.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** Today as YYYY-MM-DD, for date inputs. This is only a default; the API decides what it means. */
export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Plain words for the reasons a sale can be kept for review (the business rules name them). */
export function reasonInWords(reason: string): string {
  const code = reason.split(":")[0]?.trim() ?? reason;
  switch (code) {
    case "PAYMENT_SHORT":
      return "The payments add up to less than the total.";
    case "PAYMENT_MISSING":
      return "No payment has been entered.";
    case "TENDER_NOT_POSITIVE":
      return "A payment amount is zero or negative.";
    case "CHANGE_NOT_FROM_CASH":
      return "Change is owed, but no cash was taken to give it back.";
    case "STOCK_SHORT":
      return "Not enough unexpired stock for this sale.";
    case "PERIOD_CLOSED":
      return "The sale's date is in a closed period.";
    case "DISCOUNT_NEEDS_APPROVAL":
      return "The bill discount is above the limit and needs a manager's approval.";
    case "DISCOUNT_REASON_MISSING":
      return "The bill discount needs a reason.";
    default:
      return reason;
  }
}
