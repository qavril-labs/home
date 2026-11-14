import type {
  Invoice,
  InvoiceStatus,
  Bill,
  BillStatus,
  AgingBucket,
  StatusType,
} from "../../types";

/**
 * Pure helper for normalizing decimal string values (e.g. "120" -> "120.00").
 * Prevents floating-point precision drift.
 */
export function toDecimalString(val: string | number): string {
  const str = String(val).trim().replace(/,/g, "");
  if (!str) return "0.00";
  const cleaned = str.replace(/[^0-9.]/g, "");
  if (!cleaned) return "0.00";
  const [intPart = "0", decPart = "00"] = cleaned.split(".");
  const paddedDec = (decPart + "00").slice(0, 2);
  const normalizedInt = intPart.replace(/^0+(?=\d)/, "") || "0";
  return `${normalizedInt}.${paddedDec}`;
}

/**
 * Multiplies an integer quantity by a unit price decimal string using string/integer minor units.
 * No browser floating arithmetic.
 */
export function calculateLineTotal(quantity: number, unitPriceStr: string): string {
  const q = Math.max(0, Math.floor(quantity));
  const normalized = toDecimalString(unitPriceStr);
  const [intStr = "0", decStr = "00"] = normalized.split(".");
  const cents = (parseInt(intStr, 10) || 0) * 100 + (parseInt(decStr, 10) || 0);
  const totalCents = cents * q;
  const totalInt = Math.floor(totalCents / 100);
  const totalDec = String(totalCents % 100).padStart(2, "0");
  return `${totalInt}.${totalDec}`;
}

/**
 * Computes subtotal, tax, and total from an array of invoice line items using integer minor units.
 */
export function calculateInvoiceTotals(
  lines: { quantity: number; unitPrice: string; taxRate: string }[]
): {
  subtotal: string;
  taxTotal: string;
  total: string;
} {
  let subtotalCents = 0;
  let taxCents = 0;

  for (const line of lines) {
    const q = Math.max(0, Math.floor(line.quantity));
    const normalizedPrice = toDecimalString(line.unitPrice);
    const [pInt = "0", pDec = "00"] = normalizedPrice.split(".");
    const linePriceCents = (parseInt(pInt, 10) || 0) * 100 + (parseInt(pDec, 10) || 0);
    const lineSubtotalCents = linePriceCents * q;
    subtotalCents += lineSubtotalCents;

    const rateNum = parseFloat(line.taxRate || "0") || 0;
    taxCents += Math.round(lineSubtotalCents * rateNum);
  }

  const totalCents = subtotalCents + taxCents;

  const toStr = (cents: number) => {
    const i = Math.floor(cents / 100);
    const d = String(cents % 100).padStart(2, "0");
    return `${i}.${d}`;
  };

  return {
    subtotal: toStr(subtotalCents),
    taxTotal: toStr(taxCents),
    total: toStr(totalCents),
  };
}

/**
 * Maps invoice status to UI StatusChip status and human-readable label.
 */
export function getInvoiceStatusChip(status: InvoiceStatus): {
  status: StatusType;
  label: string;
} {
  switch (status) {
    case "paid":
      return { status: "good", label: "Paid" };
    case "partially_paid":
      return { status: "watch", label: "Partially Paid" };
    case "issued":
    case "sent":
      return { status: "good", label: status === "sent" ? "Sent" : "Issued" };
    case "draft":
      return { status: "idle", label: "Draft" };
    case "overdue":
      return { status: "act", label: "Overdue" };
    case "void":
    default:
      return { status: "idle", label: "Void" };
  }
}

/**
 * Maps bill status to UI StatusChip status and human-readable label.
 */
export function getBillStatusChip(status: BillStatus): {
  status: StatusType;
  label: string;
} {
  switch (status) {
    case "paid":
      return { status: "good", label: "Paid" };
    case "approved":
      return { status: "good", label: "Approved" };
    case "pending_approval":
      return { status: "watch", label: "Needs Approval" };
    case "draft":
      return { status: "idle", label: "Draft" };
    case "overdue":
      return { status: "act", label: "Overdue" };
    case "disputed":
      return { status: "act", label: "Disputed" };
  }
}

/**
 * Computes AR aging buckets from a list of customer invoices.
 */
export function computeReceivablesAging(
  invoices: Invoice[],
  asOfDate: string = "2026-11-10"
): AgingBucket {
  let currentCents = 0;
  let days30Cents = 0;
  let days60Cents = 0;
  let days90PlusCents = 0;
  let totalCents = 0;

  const asOf = new Date(asOfDate).getTime();

  for (const inv of invoices) {
    if (inv.status === "paid" || inv.status === "void") continue;

    const balanceNorm = toDecimalString(inv.balanceDue);
    const [bInt = "0", bDec = "00"] = balanceNorm.split(".");
    const balanceCents = (parseInt(bInt, 10) || 0) * 100 + (parseInt(bDec, 10) || 0);
    if (balanceCents <= 0) continue;

    totalCents += balanceCents;
    const dueDate = new Date(inv.dueDate).getTime();
    const diffDays = Math.floor((asOf - dueDate) / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) {
      currentCents += balanceCents;
    } else if (diffDays <= 30) {
      days30Cents += balanceCents;
    } else if (diffDays <= 60) {
      days60Cents += balanceCents;
    } else {
      days90PlusCents += balanceCents;
    }
  }

  const toStr = (c: number) => {
    const i = Math.floor(c / 100);
    const d = String(c % 100).padStart(2, "0");
    return `${i}.${d}`;
  };

  return {
    current: toStr(currentCents),
    days30: toStr(days30Cents),
    days60: toStr(days60Cents),
    days90Plus: toStr(days90PlusCents),
    totalOutstanding: toStr(totalCents),
  };
}

/**
 * Computes AP aging buckets from a list of vendor bills.
 */
export function computePayablesAging(
  bills: Bill[],
  asOfDate: string = "2026-11-10"
): AgingBucket {
  let currentCents = 0;
  let days30Cents = 0;
  let days60Cents = 0;
  let days90PlusCents = 0;
  let totalCents = 0;

  const asOf = new Date(asOfDate).getTime();

  for (const bill of bills) {
    if (bill.status === "paid") continue;

    const balanceNorm = toDecimalString(bill.balanceDue);
    const [bInt = "0", bDec = "00"] = balanceNorm.split(".");
    const balanceCents = (parseInt(bInt, 10) || 0) * 100 + (parseInt(bDec, 10) || 0);
    if (balanceCents <= 0) continue;

    totalCents += balanceCents;
    const dueDate = new Date(bill.dueDate).getTime();
    const diffDays = Math.floor((asOf - dueDate) / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) {
      currentCents += balanceCents;
    } else if (diffDays <= 30) {
      days30Cents += balanceCents;
    } else if (diffDays <= 60) {
      days60Cents += balanceCents;
    } else {
      days90PlusCents += balanceCents;
    }
  }

  const toStr = (c: number) => {
    const i = Math.floor(c / 100);
    const d = String(c % 100).padStart(2, "0");
    return `${i}.${d}`;
  };

  return {
    current: toStr(currentCents),
    days30: toStr(days30Cents),
    days60: toStr(days60Cents),
    days90Plus: toStr(days90PlusCents),
    totalOutstanding: toStr(totalCents),
  };
}
