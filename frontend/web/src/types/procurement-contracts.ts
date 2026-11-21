/**
 * Procurement Service API Contract Types (v0.1)
 * Mapped directly from contracts/procurement.openapi.yaml
 */

export type SupplierStatus =
  | "pending-qualification"
  | "approved"
  | "conditionally-approved"
  | "on-hold"
  | "rejected";

export type SupplierGrade = "A" | "B" | "C" | "D";

export interface Supplier {
  id: string;
  partyId: string;
  name: string;
  status: SupplierStatus;
  categories: string[];
  grade?: SupplierGrade | null;
  score?: string | null;
  qualifiedOn?: string | null;
  nextReviewOn?: string | null;
  trialUntil?: string | null;
}

export interface CreateSupplierRequest {
  partyId: string;
  categories: string[];
}

export interface ScorecardCriterionScore {
  criterion: string;
  score: number; // 1-5
}

export interface RecordQualificationRequest {
  scores: ScorecardCriterionScore[];
  criticalFailure?: boolean;
  outcome: SupplierStatus;
}

export interface SupplierPage {
  items: Supplier[];
  nextCursor?: string | null;
}

export type PurchaseRequestStatus =
  | "submitted"
  | "in-approval"
  | "approved"
  | "rejected"
  | "cancelled"
  | "converted";

export interface PurchaseRequestLine {
  itemId: string;
  description?: string;
  specification?: string;
  quantity: string;
  requiredBy: string;
}

export interface PurchaseRequest {
  id: string;
  number: string;
  status: PurchaseRequestStatus;
  source: "stores-reorder" | "stores-order-shortage" | "department";
  requestedBy: string;
  departmentId?: string;
  lines: PurchaseRequestLine[];
  createdAt: string;
}

export interface CreatePurchaseRequestRequest {
  source: "stores-reorder" | "stores-order-shortage" | "department";
  departmentId?: string;
  lines: PurchaseRequestLine[];
}

export interface PurchaseRequestPage {
  items: PurchaseRequest[];
  nextCursor?: string | null;
}

export interface DecisionRequest {
  decision: "approve" | "reject";
  comment?: string;
}

export type RfqStatus = "open" | "quotes-in" | "compared" | "awarded" | "cancelled";

export interface RfqVendorQuote {
  supplierId: string;
  unitPrice: string;
  currency: string;
  taxRate?: string;
  freight?: string;
  insurance?: string;
  leadTimeDays: number;
  paymentTerms?: string;
  warrantyMonths?: number;
  validUntil?: string;
  deviations?: string;
  quotedAt?: string;
}

export interface Rfq {
  id: string;
  number: string;
  status: RfqStatus;
  purchaseRequestIds: string[];
  suppliers: string[];
  responseDeadline?: string;
  deliveryLocation?: string;
  quotes: RfqVendorQuote[];
  awardedSupplierId?: string | null;
}

export interface CreateRfqRequest {
  purchaseRequestIds: string[];
  supplierIds: string[];
  responseDeadline?: string;
  deliveryLocation?: string;
  termsAndConditions?: string;
}

export interface RfqPage {
  items: Rfq[];
  nextCursor?: string | null;
}

export interface ComparisonRow {
  supplierId: string;
  landedUnitPrice: string;
  leadTimeDays: number;
  meetsDeliveryDate?: boolean;
  complianceNotes?: string;
  rank: number;
  recommended: boolean;
}

export interface Comparison {
  rfqId: string;
  rows: ComparisonRow[];
  recommendedSupplierId?: string | null;
  missingQuotes?: string[];
}

export interface AwardRfqRequest {
  supplierId: string;
  justification: string;
}

export type PurchaseOrderStatus =
  | "draft"
  | "in-approval"
  | "approved"
  | "rejected"
  | "released"
  | "acknowledged"
  | "partially-received"
  | "received"
  | "closed"
  | "cancelled";

export interface PurchaseOrderLine {
  lineNo: number;
  itemId: string;
  itemSku?: string;
  description?: string;
  unit?: string;
  quantity: string;
  receivedQuantity?: string;
  unitPrice: string;
  taxRate: string;
  requiredBy: string;
  lineTotal?: string;
}

export interface PurchaseOrder {
  id: string;
  number: string;
  status: PurchaseOrderStatus;
  supplierId: string;
  supplierName?: string;
  rfqId?: string | null;
  currency: string;
  paymentTerms?: string;
  deliveryLocation?: string;
  lines: PurchaseOrderLine[];
  total: string;
  approvalStep?: number | null;
  acknowledgedOn?: string | null;
  dueAcknowledgementAt?: string | null;
  createdAt: string;
}

export interface CreatePurchaseOrderRequest {
  supplierId: string;
  rfqId?: string;
  currency: string;
  paymentTerms?: string;
  deliveryLocation?: string;
  lines: Array<{
    itemId: string;
    description?: string;
    quantity: string;
    unitPrice: string;
    taxRate: string;
    requiredBy: string;
  }>;
}

export interface AcknowledgePurchaseOrderRequest {
  acknowledgedOn: string;
  signedCopyRef: string;
}

export interface PurchaseOrderPage {
  items: PurchaseOrder[];
  nextCursor?: string | null;
}
