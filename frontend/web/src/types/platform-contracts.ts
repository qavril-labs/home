/**
 * Platform Service API Contract Types (v0.1)
 * Mapped directly from contracts/platform.openapi.yaml
 */

export type ProductKey = "platform" | "procurement" | "stores" | "sales" | "production" | "finance";

export type ApprovalRole =
  | "department-head"
  | "purchase-manager"
  | "finance-controller"
  | "operations-director"
  | "managing-director"
  | "board";

export interface Product {
  key: ProductKey;
  name: string;
  repository: string;
  status: "available" | "planned";
  catalogIds?: string[];
}

export interface Entitlement {
  productKey: ProductKey;
  enabled: boolean;
  enabledAt?: string | null;
  updatedAt: string;
}

export interface SetEntitlementRequest {
  enabled: boolean;
}

export interface ApprovalStep {
  role: ApprovalRole;
  order: number;
}

export interface ApprovalBand {
  minAmount: string;
  maxAmount?: string | null;
  steps: ApprovalStep[];
}

export interface ApprovalMatrix {
  id: string;
  process: string;
  version: number;
  status: "draft" | "active" | "retired";
  bands: ApprovalBand[];
}

export interface CreateApprovalMatrixRequest {
  process: string;
  bands: ApprovalBand[];
}

export interface Sequence {
  key: string;
  prefix: string;
  nextNumber: number;
  branchId: string;
}

export interface UpdateSequenceRequest {
  prefix?: string;
  nextNumber?: number;
}

export interface AuditEntry {
  id: string;
  at: string;
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  changes?: Record<string, unknown>;
}

export interface AuditPage {
  items: AuditEntry[];
  nextCursor?: string | null;
}
