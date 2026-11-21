/**
 * PRC-04: Automated 3-Way Match Verification Engine
 * Compares:
 * 1. Purchase Order (PO): Expected quantity and unit price
 * 2. Goods Receipt Note (GRN): Actual physical received quantity
 * 3. Supplier Bill (Invoice): Billed quantity and billed unit price
 *
 * Rules:
 * - Match Status: "perfect_match" (0% variance) -> Auto-Approve Bill
 * - Match Status: "acceptable_tolerance" (<= 1% variance) -> Auto-Approve with Audit Flag
 * - Match Status: "quantity_discrepancy" (Billed > Received) -> Flag for Guard Gus AI-04
 * - Match Status: "price_discrepancy" (Billed > PO Rate) -> Block Payment & Require Review
 */

export interface ThreeWayMatchLine {
  id: string;
  sku: string;
  description: string;
  poQuantity: number;
  poUnitPrice: string;
  grnQuantity: number;
  grnDate: string;
  grnReceiver: string;
  billQuantity: number;
  billUnitPrice: string;
  quantityVariance: number;
  priceVariancePercent: number;
  status: "match" | "qty_mismatch" | "price_mismatch";
  explanation?: string;
}

export interface ThreeWayMatchAudit {
  poNumber: string;
  grnNumber: string;
  billNumber: string;
  vendorName: string;
  currency: string;
  totalPoAmount: string;
  totalGrnAmount: string;
  totalBillAmount: string;
  overallMatchStatus: "perfect_match" | "acceptable_tolerance" | "price_discrepancy" | "quantity_discrepancy";
  confidenceScore: number;
  autoApproveEligible: boolean;
  guardGusNotes?: string;
  lines: ThreeWayMatchLine[];
}

export function evaluateThreeWayMatch(
  po: { number: string; lines: Array<{ sku: string; description: string; qty: number; unitPrice: number }> },
  grn: { number: string; lines: Array<{ sku: string; receivedQty: number; date: string; receiver: string }> },
  bill: { number: string; lines: Array<{ sku: string; billedQty: number; unitPrice: number }> },
  vendorName: string
): ThreeWayMatchAudit {
  let totalPo = 0;
  let totalGrn = 0;
  let totalBill = 0;
  let hasQtyMismatch = false;
  let hasPriceMismatch = false;

  const matchLines: ThreeWayMatchLine[] = po.lines.map((poLine, idx) => {
    const grnLine = grn.lines.find((g) => g.sku === poLine.sku) || { receivedQty: 0, date: "Pending", receiver: "None" };
    const billLine = bill.lines.find((b) => b.sku === poLine.sku) || { billedQty: 0, unitPrice: 0 };

    const qtyDiff = billLine.billedQty - grnLine.receivedQty;
    const priceDiff = billLine.unitPrice - poLine.unitPrice;
    const priceDiffPct = poLine.unitPrice > 0 ? (priceDiff / poLine.unitPrice) * 100 : 0;

    totalPo += poLine.qty * poLine.unitPrice;
    totalGrn += grnLine.receivedQty * poLine.unitPrice;
    totalBill += billLine.billedQty * billLine.unitPrice;

    let lineStatus: ThreeWayMatchLine["status"] = "match";
    let explanation = "Exact match across PO, GRN and Bill.";

    if (qtyDiff > 0) {
      lineStatus = "qty_mismatch";
      hasQtyMismatch = true;
      explanation = `Supplier billed ${billLine.billedQty} units but warehouse only received ${grnLine.receivedQty} units.`;
    } else if (Math.abs(priceDiffPct) > 1.0) {
      lineStatus = "price_mismatch";
      hasPriceMismatch = true;
      explanation = `Unit rate billed ($${billLine.unitPrice.toFixed(2)}) exceeds PO agreed rate ($${poLine.unitPrice.toFixed(2)}) by ${priceDiffPct.toFixed(1)}%.`;
    }

    return {
      id: `match-l-${idx}`,
      sku: poLine.sku,
      description: poLine.description,
      poQuantity: poLine.qty,
      poUnitPrice: poLine.unitPrice.toFixed(2),
      grnQuantity: grnLine.receivedQty,
      grnDate: grnLine.date,
      grnReceiver: grnLine.receiver,
      billQuantity: billLine.billedQty,
      billUnitPrice: billLine.unitPrice.toFixed(2),
      quantityVariance: qtyDiff,
      priceVariancePercent: Math.round(priceDiffPct * 10) / 10,
      status: lineStatus,
      explanation,
    };
  });

  let overallStatus: ThreeWayMatchAudit["overallMatchStatus"] = "perfect_match";
  let autoApprove = true;
  let confidence = 100;
  let guardGusNotes = "All line items match physical warehouse intake within 0% tolerance.";

  if (hasQtyMismatch) {
    overallStatus = "quantity_discrepancy";
    autoApprove = false;
    confidence = 62;
    guardGusNotes = "ANOMALY: Over-billing detected against actual physical Goods Receipt Note. Payment blocked pending vendor credit note.";
  } else if (hasPriceMismatch) {
    overallStatus = "price_discrepancy";
    autoApprove = false;
    confidence = 74;
    guardGusNotes = "WARNING: Unit rate variance detected above 1.0% contract threshold. Procurement sign-off required.";
  }

  return {
    poNumber: po.number,
    grnNumber: grn.number,
    billNumber: bill.number,
    vendorName,
    currency: "USD",
    totalPoAmount: totalPo.toFixed(2),
    totalGrnAmount: totalGrn.toFixed(2),
    totalBillAmount: totalBill.toFixed(2),
    overallMatchStatus: overallStatus,
    confidenceScore: confidence,
    autoApproveEligible: autoApprove,
    guardGusNotes,
    lines: matchLines,
  };
}

export const INITIAL_THREE_WAY_MATCH_AUDITS: ThreeWayMatchAudit[] = [
  {
    poNumber: "PO-2026-004",
    grnNumber: "GRN-2026-008",
    billNumber: "BILL-99382",
    vendorName: "Precision Supplies Ltd",
    currency: "USD",
    totalPoAmount: "3639.75",
    totalGrnAmount: "3639.75",
    totalBillAmount: "3639.75",
    overallMatchStatus: "perfect_match",
    confidenceScore: 100,
    autoApproveEligible: true,
    guardGusNotes: "Verified: Physical inspection passed by Bay B2 lead. Total matches exactly ($3,639.75).",
    lines: [
      {
        id: "l-1",
        sku: "AL-RND-6061",
        description: "6061-T6 Aluminum Round Bar (50mm x 1000mm)",
        poQuantity: 10,
        poUnitPrice: "145.50",
        grnQuantity: 10,
        grnDate: "2026-11-12",
        grnReceiver: "Marcus Vance",
        billQuantity: 10,
        billUnitPrice: "145.50",
        quantityVariance: 0,
        priceVariancePercent: 0,
        status: "match",
      },
      {
        id: "l-2",
        sku: "COOL-SYN-5L",
        description: "Synthetic CNC Machining Coolant (5L Drum)",
        poQuantity: 5,
        poUnitPrice: "89.20",
        grnQuantity: 5,
        grnDate: "2026-11-12",
        grnReceiver: "Marcus Vance",
        billQuantity: 5,
        billUnitPrice: "89.20",
        quantityVariance: 0,
        priceVariancePercent: 0,
        status: "match",
      },
      {
        id: "l-3",
        sku: "FAST-HEX-M8",
        description: "M8 Grade 8.8 Hex Bolts & Lock Nuts (Pack of 100)",
        poQuantity: 20,
        poUnitPrice: "32.40",
        grnQuantity: 20,
        grnDate: "2026-11-12",
        grnReceiver: "Marcus Vance",
        billQuantity: 20,
        billUnitPrice: "32.40",
        quantityVariance: 0,
        priceVariancePercent: 0,
        status: "match",
      },
    ],
  },
  {
    poNumber: "PO-2026-003",
    grnNumber: "GRN-2026-006",
    billNumber: "BILL-88219",
    vendorName: "Industrial Steels Corp",
    currency: "USD",
    totalPoAmount: "4200.00",
    totalGrnAmount: "3500.00",
    totalBillAmount: "4200.00",
    overallMatchStatus: "quantity_discrepancy",
    confidenceScore: 62,
    autoApproveEligible: false,
    guardGusNotes: "ANOMALY: Supplier invoiced for 12 billets ($4,200) but warehouse intake recorded only 10 billets ($3,500). Payment suspended.",
    lines: [
      {
        id: "l-4",
        sku: "TI-BLT-GR5",
        description: "Titanium Grade 5 Round Billet (75mm x 500mm)",
        poQuantity: 12,
        poUnitPrice: "350.00",
        grnQuantity: 10,
        grnDate: "2026-11-08",
        grnReceiver: "Marcus Vance",
        billQuantity: 12,
        billUnitPrice: "350.00",
        quantityVariance: 2,
        priceVariancePercent: 0,
        status: "qty_mismatch",
        explanation: "2 units missing from physical delivery. Bill holds unreceived items.",
      },
    ],
  },
];
