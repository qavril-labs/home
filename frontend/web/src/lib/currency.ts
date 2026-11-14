/**
 * Currency, Number, and Date display helpers per UI Contract:
 * - "Never calculate money in the browser. Show the decimal strings the API returns, formatted as $1,234.50"
 * - Handles negative amounts with a leading minus sign (e.g. -$450.00 or -$1,234.50)
 * - Pure string formatting: never uses floating-point arithmetic on money.
 */

export function normalizeDecimalString(raw: string): string | null {
  const cleaned = raw.trim().replace(/,/g, "");
  if (!cleaned) return null;

  const isNegative = cleaned.startsWith("-");
  const unsigned = isNegative || cleaned.startsWith("+") ? cleaned.slice(1) : cleaned;
  if (!/^\d*(\.\d*)?$/.test(unsigned) || unsigned === "" || unsigned === ".") {
    return null;
  }

  const [rawInt = "", rawDec = ""] = unsigned.split(".");
  const intPart = rawInt.replace(/^0+(?=\d)/, "") || "0";
  const paddedDec = (rawDec + "00").slice(0, 2);
  const isZero = /^0+$/.test(intPart) && paddedDec === "00";

  return `${isNegative && !isZero ? "-" : ""}${intPart}.${paddedDec}`;
}

export function formatMoney(amountStr: string | number | null | undefined, currencySymbol: string = "$"): string {
  if (amountStr === null || amountStr === undefined || amountStr === "") {
    return `${currencySymbol}0.00`;
  }

  const raw =
    typeof amountStr === "number"
      ? Number.isFinite(amountStr)
        ? amountStr.toFixed(2)
        : "0.00"
      : String(amountStr);

  const normalized = normalizeDecimalString(raw);
  if (!normalized) {
    return `${currencySymbol}0.00`;
  }

  const isNegative = normalized.startsWith("-");
  const unsigned = isNegative ? normalized.slice(1) : normalized;
  const [intPart = "0", decPart = "00"] = unsigned.split(".");
  const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  const formatted = `${currencySymbol}${formattedInt}.${decPart}`;
  return isNegative ? `-${formatted}` : formatted;
}

/**
 * Converts a decimal string (e.g. "-1234.50") to integer minor units (cents)
 * using BigInt string parsing for animation interpolation only — no floats.
 */
export function parseMoneyToMinorUnits(amountStr: string): bigint | null {
  const normalized = normalizeDecimalString(amountStr);
  if (!normalized) return null;

  const isNegative = normalized.startsWith("-");
  const unsigned = isNegative ? normalized.slice(1) : normalized;
  const [intPart = "0", decPart = "00"] = unsigned.split(".");
  const units = BigInt(intPart) * 100n + BigInt(decPart);
  return isNegative ? -units : units;
}

export function minorUnitsToDecimalString(units: bigint): string {
  const isNegative = units < 0n;
  const abs = isNegative ? -units : units;
  const intPart = abs / 100n;
  const decPart = abs % 100n;
  const decStr = decPart < 10n ? `0${decPart.toString()}` : decPart.toString();
  return `${isNegative ? "-" : ""}${intPart.toString()}.${decStr}`;
}

export function formatDate(dateStr: string): string {
  // Returns date as API sends it (e.g. 2026-11-10)
  if (!dateStr) return "";
  return dateStr.split("T")[0] || dateStr;
}

export function formatMonthName(monthStr: string): string {
  // e.g. "2026-05" -> "May"
  if (!monthStr) return "";
  const parts = monthStr.split("-");
  if (parts.length >= 2) {
    const monthIndex = parseInt(parts[1] || "1", 10) - 1;
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return months[monthIndex] || monthStr;
  }
  return monthStr;
}
