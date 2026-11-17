import { DomainError } from "@erp/kernel";
import type { Money } from "@erp/money";
import type { Tender } from "./payments";
import type { PricedLine } from "./pricing";

export type SaleStatus = "POSTED" | "NEEDS_REVIEW";
export type DecisionKind = "POSTED" | "VOIDED";

/** A sale as stored. Stored sales are never changed. A sale that needs review is kept, not dropped. */
export interface PosSale {
  /** The client-generated UUID of the sale. */
  readonly id: string;
  readonly companyId: string;
  readonly status: SaleStatus;
  /** Receipt number. Assigned only when the sale is posted. */
  readonly number: string | null;
  readonly warehouse: string;
  readonly date: string;
  readonly currency: string;
  readonly lines: readonly PricedLine[];
  readonly tenders: readonly Tender[];
  /** Discount on the whole bill, shared across the lines (DISC-001). Zero when there is none. */
  readonly billDiscount: Money;
  readonly billDiscountReason: string | null;
  /** The approver who signed off a bill discount above the threshold, or null. */
  readonly billDiscountApprovedBy: string | null;
  readonly subtotal: Money;
  readonly tax: Money;
  readonly total: Money;
  readonly change: Money;
  /** Cost of the stock issued for the sale, or null when no stock was issued. */
  readonly cost: Money | null;
  /** The ledger entry for the sale. Null until the sale is posted. */
  readonly entryId: string | null;
  /** Why the sale needs review. Empty for a posted sale. */
  readonly reasons: readonly string[];
  readonly recordedAt: string;
  /** How a person resolved the review, or null while the sale is still waiting. Never stored on the sale row. */
  readonly resolution: PosDecision | null;
}

/**
 * The decision a person made about a sale that needed review. It sits beside the sale, which is never
 * changed. POSTED means the sale was posted later, with a receipt number and a ledger entry on `postedOn`.
 * VOIDED means it will never be posted.
 */
export interface PosDecision {
  readonly saleId: string;
  readonly companyId: string;
  readonly decision: DecisionKind;
  readonly decidedBy: string;
  readonly decidedAt: string;
  readonly reason: string;
  readonly postedOn: string | null;
  readonly number: string | null;
  readonly entryId: string | null;
  readonly cost: Money | null;
  readonly change: Money;
  /** The payments as they were reconciled for the decision. For a void, the payments as they were recorded. */
  readonly tenders: readonly Tender[];
}

export interface PosStore {
  /**
   * Takes a lock for one sale, held until the surrounding transaction ends, so two syncs of the same sale
   * cannot both post it. The Postgres store takes a transaction-scoped advisory lock; the memory store does nothing.
   */
  lock(companyId: string, saleId: string): Promise<void>;
  /** The sale, with its resolution attached when there is one. */
  find(companyId: string, saleId: string): Promise<PosSale | undefined>;
  /** Stores a new sale. Throws CONFLICT if the id is already stored. */
  save(sale: PosSale): Promise<void>;
  /** Stores the decision on a sale that needed review. Throws CONFLICT if the sale already has one. */
  saveDecision(decision: PosDecision): Promise<void>;
  /** Sales, each with its resolution attached, optionally only those with one stored status. */
  list(companyId: string, status?: SaleStatus): Promise<PosSale[]>;
}

/** Store for unit tests and local runs. Production uses the Postgres store in @erp/db. */
export class InMemoryPosStore implements PosStore {
  private readonly sales = new Map<string, PosSale>();
  private readonly decisions = new Map<string, PosDecision>();

  async lock(): Promise<void> {
    return undefined;
  }

  async find(companyId: string, saleId: string): Promise<PosSale | undefined> {
    const sale = this.sales.get(keyOf(companyId, saleId));
    return sale ? this.withResolution(sale) : undefined;
  }

  async save(sale: PosSale): Promise<void> {
    const key = keyOf(sale.companyId, sale.id);
    if (this.sales.has(key)) {
      throw new DomainError("CONFLICT", `Sale ${sale.id} is already stored`);
    }
    this.sales.set(key, sale);
  }

  async saveDecision(decision: PosDecision): Promise<void> {
    const key = keyOf(decision.companyId, decision.saleId);
    if (this.decisions.has(key)) {
      throw new DomainError("CONFLICT", `Sale ${decision.saleId} has already been decided`);
    }
    this.decisions.set(key, decision);
  }

  async list(companyId: string, status?: SaleStatus): Promise<PosSale[]> {
    return [...this.sales.values()]
      .filter((sale) => sale.companyId === companyId && (!status || sale.status === status))
      .map((sale) => this.withResolution(sale));
  }

  private withResolution(sale: PosSale): PosSale {
    return { ...sale, resolution: this.decisions.get(keyOf(sale.companyId, sale.id)) ?? null };
  }
}

function keyOf(companyId: string, saleId: string): string {
  return `${companyId}|${saleId}`;
}
