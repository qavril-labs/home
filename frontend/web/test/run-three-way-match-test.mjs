import test from "node:test";
import assert from "node:assert/strict";

// PRC-04: 3-Way Match Verification Test Suite
import { evaluateThreeWayMatch } from "../src/lib/three-way-match.ts";

test("PRC-04: Perfect 3-Way Match auto-approves within 0% tolerance", () => {
  const po = {
    number: "PO-TEST-001",
    lines: [{ sku: "SKU-A", description: "Precision Ball Bearing", qty: 10, unitPrice: 25.0 }],
  };
  const grn = {
    number: "GRN-TEST-001",
    lines: [{ sku: "SKU-A", receivedQty: 10, date: "2026-11-15", receiver: "Marcus Vance" }],
  };
  const bill = {
    number: "BILL-TEST-001",
    lines: [{ sku: "SKU-A", billedQty: 10, unitPrice: 25.0 }],
  };

  const audit = evaluateThreeWayMatch(po, grn, bill, "Precision Bearing Co");

  assert.equal(audit.overallMatchStatus, "perfect_match");
  assert.equal(audit.autoApproveEligible, true);
  assert.equal(audit.confidenceScore, 100);
  assert.equal(audit.totalPoAmount, "250.00");
  assert.equal(audit.totalGrnAmount, "250.00");
  assert.equal(audit.totalBillAmount, "250.00");
});

test("PRC-04: Quantity discrepancy blocks payment when billed > received", () => {
  const po = {
    number: "PO-TEST-002",
    lines: [{ sku: "SKU-B", description: "Titanium Rod", qty: 20, unitPrice: 50.0 }],
  };
  const grn = {
    number: "GRN-TEST-002",
    lines: [{ sku: "SKU-B", receivedQty: 15, date: "2026-11-15", receiver: "Marcus Vance" }],
  };
  const bill = {
    number: "BILL-TEST-002",
    lines: [{ sku: "SKU-B", billedQty: 20, unitPrice: 50.0 }],
  };

  const audit = evaluateThreeWayMatch(po, grn, bill, "Titanium Alloy Corp");

  assert.equal(audit.overallMatchStatus, "quantity_discrepancy");
  assert.equal(audit.autoApproveEligible, false);
  assert.equal(audit.confidenceScore, 62);
  assert.equal(audit.lines[0]?.quantityVariance, 5); // 20 billed - 15 received
});

test("PRC-04: Price discrepancy triggers Guard Gus warning above 1% tolerance", () => {
  const po = {
    number: "PO-TEST-003",
    lines: [{ sku: "SKU-C", description: "Cutting Fluid 5L", qty: 5, unitPrice: 40.0 }],
  };
  const grn = {
    number: "GRN-TEST-003",
    lines: [{ sku: "SKU-C", receivedQty: 5, date: "2026-11-15", receiver: "Marcus Vance" }],
  };
  const bill = {
    number: "BILL-TEST-003",
    lines: [{ sku: "SKU-C", billedQty: 5, unitPrice: 45.0 }], // $45 vs $40 PO (+12.5%)
  };

  const audit = evaluateThreeWayMatch(po, grn, bill, "Chemical Supplies Inc");

  assert.equal(audit.overallMatchStatus, "price_discrepancy");
  assert.equal(audit.autoApproveEligible, false);
  assert.equal(audit.lines[0]?.priceVariancePercent, 12.5);
});
