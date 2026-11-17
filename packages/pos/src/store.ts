import { DomainError } from "@erp/kernel";
import type { Money } from "@erp/money";
import type { Tender } from "./payments";
import type { PricedLine } from "./pricing";

export type SaleStatus = "POSTED" | "NEEDS_REVIEW";

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
}

export interface PosStore {
  /**
   * Takes a lock for one sale, held until the surrounding transaction ends, so two syncs of the same sale
   * cannot both post it. The Postgres store takes a transaction-scoped advisory lock; the memory store does nothing.
   */
  lock(companyId: string, saleId: string): Promise<void>;
  find(companyId: string, saleId: string): Promise<PosSale | undefined>;
  /** Stores a new sale. Throws CONFLICT if the id is already stored. */
  save(sale: PosSale): Promise<void>;
  list(companyId: string, status?: SaleStatus): Promise<PosSale[]>;
}

/** Store for unit tests and local runs. Production uses the Postgres store in @erp/db. */
export class InMemoryPosStore implements PosStore {
  private readonly sales = new Map<string, PosSale>();

  async lock(): Promise<void> {
    return undefined;
  }

  async find(companyId: string, saleId: string): Promise<PosSale | undefined> {
    return this.sales.get(keyOf(companyId, saleId));
  }

  async save(sale: PosSale): Promise<void> {
    const key = keyOf(sale.companyId, sale.id);
    if (this.sales.has(key)) {
      throw new DomainError("CONFLICT", `Sale ${sale.id} is already stored`);
    }
    this.sales.set(key, sale);
  }

  async list(companyId: string, status?: SaleStatus): Promise<PosSale[]> {
    return [...this.sales.values()].filter((sale) => sale.companyId === companyId && (!status || sale.status === status));
  }
}

function keyOf(companyId: string, saleId: string): string {
  return `${companyId}|${saleId}`;
}
