import test from "node:test";
import assert from "node:assert/strict";
import {
  toDecimalString,
  calculateLineTotal,
  calculateInvoiceTotals,
  getInvoiceStatusChip,
  getBillStatusChip,
  computeReceivablesAging,
  computePayablesAging,
} from "../src/modules/invoicing/invoiceHelpers.ts";
import { formatMoney } from "../src/lib/currency.ts";
import {
  initialMockInvoices,
  initialMockInvoicesSummary,
  initialMockBills,
} from "../src/lib/api-mock.ts";

test("SAL-04: Decimal normalization and minor-unit line total calculation", () => {
  assert.equal(toDecimalString("120"), "120.00");
  assert.equal(toDecimalString("1,234.5"), "1234.50");
  assert.equal(calculateLineTotal(4, "285.00"), "1140.00");
  assert.equal(calculateLineTotal(2, "1945.25"), "3890.50");
});

test("SAL-04: Invoice subtotal, taxTotal, and total calculation via integer minor units", () => {
  const totals = calculateInvoiceTotals([
    { quantity: 4, unitPrice: "285.00", taxRate: "0.10" },
    { quantity: 4, unitPrice: "70.00", taxRate: "0.10" },
  ]);
  assert.equal(totals.subtotal, "1420.00");
  assert.equal(totals.taxTotal, "142.00");
  assert.equal(totals.total, "1562.00");
});

test("SAL-04 & FIN-02: Invoice and Bill StatusChip mapping", () => {
  assert.deepEqual(getInvoiceStatusChip("paid"), { status: "good", label: "Paid" });
  assert.deepEqual(getInvoiceStatusChip("overdue"), { status: "act", label: "Overdue" });
  assert.deepEqual(getInvoiceStatusChip("partially_paid"), { status: "watch", label: "Partially Paid" });
  assert.deepEqual(getInvoiceStatusChip("draft"), { status: "idle", label: "Draft" });

  assert.deepEqual(getBillStatusChip("paid"), { status: "good", label: "Paid" });
  assert.deepEqual(getBillStatusChip("pending_approval"), { status: "watch", label: "Needs Approval" });
  assert.deepEqual(getBillStatusChip("overdue"), { status: "act", label: "Overdue" });
});

test("FIN-02 & FIN-03: Receivables and Payables aging buckets", () => {
  const arAging = computeReceivablesAging(initialMockInvoices, "2026-11-10");
  assert.ok(Number(arAging.totalOutstanding) > 0);
  assert.equal(formatMoney(initialMockInvoicesSummary.totalReceivable), formatMoney(arAging.totalOutstanding));

  const apAging = computePayablesAging(initialMockBills, "2026-11-10");
  assert.ok(Number(apAging.totalOutstanding) > 0);
});

test("SAL-04: Mock invoices dataset integrity and UI Contract currency formatting", () => {
  assert.ok(initialMockInvoices.length >= 3);
  for (const inv of initialMockInvoices) {
    assert.ok(inv.invoiceNumber.startsWith("INV-"));
    assert.ok(formatMoney(inv.total).startsWith("$"));
    assert.ok(formatMoney(inv.balanceDue).startsWith("$"));
  }
});
