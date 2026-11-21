import { describe, expect, it } from "vitest";
import {
  toDecimalString,
  calculateLineTotal,
  calculateInvoiceTotals,
  getInvoiceStatusChip,
  getBillStatusChip,
  computeReceivablesAging,
  computePayablesAging,
} from "../src/modules/invoicing/invoiceHelpers";
import { formatMoney } from "../src/lib/currency";
import {
  initialMockInvoices,
  initialMockInvoicesSummary,
  initialMockBills,
} from "../src/lib/api-mock";

describe("SAL-04 & FIN-02: Invoicing and Receivables", () => {
  it("SAL-04: Decimal normalization and minor-unit line total calculation", () => {
    expect(toDecimalString("120")).toBe("120.00");
    expect(toDecimalString("1,234.5")).toBe("1234.50");
    expect(calculateLineTotal(4, "285.00")).toBe("1140.00");
    expect(calculateLineTotal(2, "1945.25")).toBe("3890.50");
  });

  it("SAL-04: Invoice subtotal, taxTotal, and total calculation via integer minor units", () => {
    const totals = calculateInvoiceTotals([
      { quantity: 4, unitPrice: "285.00", taxRate: "0.10" },
      { quantity: 4, unitPrice: "70.00", taxRate: "0.10" },
    ]);
    expect(totals.subtotal).toBe("1420.00");
    expect(totals.taxTotal).toBe("142.00");
    expect(totals.total).toBe("1562.00");
  });

  it("SAL-04 & FIN-02: Invoice and Bill StatusChip mapping", () => {
    expect(getInvoiceStatusChip("paid")).toEqual({ status: "good", label: "Paid" });
    expect(getInvoiceStatusChip("overdue")).toEqual({ status: "act", label: "Overdue" });
    expect(getInvoiceStatusChip("partially_paid")).toEqual({ status: "watch", label: "Partially Paid" });
    expect(getInvoiceStatusChip("draft")).toEqual({ status: "idle", label: "Draft" });

    expect(getBillStatusChip("paid")).toEqual({ status: "good", label: "Paid" });
    expect(getBillStatusChip("pending_approval")).toEqual({ status: "watch", label: "Needs Approval" });
    expect(getBillStatusChip("overdue")).toEqual({ status: "act", label: "Overdue" });
  });

  it("FIN-02 & FIN-03: Receivables and Payables aging buckets", () => {
    const arAging = computeReceivablesAging(initialMockInvoices, "2026-11-10");
    expect(Number(arAging.totalOutstanding)).toBeGreaterThan(0);
    expect(formatMoney(initialMockInvoicesSummary.totalReceivable)).toBe(formatMoney(arAging.totalOutstanding));

    const apAging = computePayablesAging(initialMockBills, "2026-11-10");
    expect(Number(apAging.totalOutstanding)).toBeGreaterThan(0);
  });
});
