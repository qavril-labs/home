import { DomainError, isUuid, systemClock, type Clock } from "@erp/kernel";
import type { Inventory, IssueLine, StockResult } from "@erp/inventory";
import type { EntryLineInput, Ledger, PostedEntry } from "@erp/ledger";
import { Money } from "@erp/money";
import type { NumberingService } from "@erp/numbering";
import { checkTenders, TENDER_METHODS, type Tender, type TenderMethod } from "./payments";
import { priceSale, type PricedSale, type SaleLineInput } from "./pricing";
import type { PosSale, PosStore, SaleStatus } from "./store";

export const POS_SALE_SEQUENCE = "POS_SALE";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export interface PosAccounts {
  /** The ledger account each payment method is received into. */
  readonly tenders: Readonly<Record<TenderMethod, string>>;
  readonly taxPayable: string;
}

export interface SaleInput {
  /** The UUID the device gave the sale. Syncing the same sale twice stores it once. */
  readonly id: string;
  readonly companyId: string;
  readonly warehouse: string;
  readonly date: string;
  readonly currency: string;
  readonly lines: readonly SaleLineInput[];
  readonly tenders: readonly Tender[];
}

export interface RecordResult {
  readonly sale: PosSale;
  /** True when the sale was already stored, so nothing was changed this time. */
  readonly duplicate: boolean;
}

export interface PosRegisterOptions {
  readonly tenantId: string;
  readonly store: PosStore;
  readonly inventory: Inventory;
  readonly ledger: Ledger;
  readonly numbering: NumberingService;
  readonly accounts: PosAccounts;
  readonly clock?: Clock;
}

/**
 * Records point-of-sale sales (POS-01), online or synced from a device that was offline. A sale is posted
 * in full or kept for review. Posting prices the sale, checks the payment, takes stock first to expire first,
 * writes the receipt number and posts the sale to the ledger. A sale that cannot be posted as it stands (a
 * short payment, or not enough unexpired stock) is kept as NEEDS_REVIEW with the reasons, and moves no stock
 * and posts nothing, so it can be reconciled rather than lost.
 */
export class PosRegister {
  private readonly clock: Clock;

  constructor(private readonly options: PosRegisterOptions) {
    this.clock = options.clock ?? systemClock;
  }

  async record(input: SaleInput): Promise<RecordResult> {
    if (!isUuid(input.id)) {
      throw new DomainError("VALIDATION", "A sale needs the UUID the device gave it");
    }
    if (!DATE.test(input.date)) {
      throw new DomainError("VALIDATION", "Sale date must be a YYYY-MM-DD date");
    }
    if (input.warehouse.trim().length === 0) {
      throw new DomainError("VALIDATION", "A sale needs a warehouse");
    }

    await this.options.store.lock(input.companyId, input.id);
    const existing = await this.options.store.find(input.companyId, input.id);
    if (existing) {
      return { sale: existing, duplicate: true };
    }

    const priced = priceSale(input.lines, input.currency);
    if (priced.total.isZero()) {
      throw new DomainError("VALIDATION", "A sale needs a total above zero");
    }
    const payment = checkTenders(priced.total, input.tenders);
    const reasons: string[] = [...payment.problems];

    let stock: StockResult[] = [];
    const issues = stockLines(input, priced);
    if (reasons.length === 0 && issues.length > 0) {
      try {
        stock = await this.options.inventory.issueMany({ companyId: input.companyId, date: input.date, lines: issues });
      } catch (error) {
        // issueMany checks every line before it writes, so a shortage leaves no stock moved.
        if (error instanceof DomainError && error.code === "UNPROCESSABLE") {
          reasons.push(`STOCK_SHORT: ${error.message}`);
        } else {
          throw error;
        }
      }
    }

    const recordedAt = this.clock.now().toISOString();
    const base = {
      id: input.id,
      companyId: input.companyId,
      warehouse: input.warehouse,
      date: input.date,
      currency: input.currency,
      lines: priced.lines,
      tenders: input.tenders,
      subtotal: priced.subtotal,
      tax: priced.tax,
      total: priced.total,
      recordedAt,
    };

    if (reasons.length > 0) {
      const review: PosSale = {
        ...base,
        status: "NEEDS_REVIEW" satisfies SaleStatus,
        number: null,
        change: Money.zero(input.currency),
        cost: null,
        entryId: null,
        reasons,
      };
      await this.options.store.save(review);
      return { sale: review, duplicate: false };
    }

    const number = await this.options.numbering.next(this.options.tenantId, POS_SALE_SEQUENCE, input.date);
    const cost = stock.length > 0 ? stock.reduce((sum, result) => sum.add(result.cost), Money.zero(input.currency)) : null;
    const entry = await this.postSale(input, priced, payment.change, number);
    const posted: PosSale = {
      ...base,
      status: "POSTED" satisfies SaleStatus,
      number,
      change: payment.change,
      cost,
      entryId: entry.id,
      reasons: [],
    };
    await this.options.store.save(posted);
    return { sale: posted, duplicate: false };
  }

  /** Sales for a company, optionally only those with one status, such as NEEDS_REVIEW for reconciliation. */
  async sales(companyId: string, status?: SaleStatus): Promise<PosSale[]> {
    return this.options.store.list(companyId, status);
  }

  /**
   * Debits each payment account with what it received, less any change handed back in cash, and credits
   * revenue by revenue account and tax payable. The debits equal the credits, which equal the sale total.
   */
  private async postSale(input: SaleInput, priced: PricedSale, change: Money, number: string): Promise<PostedEntry> {
    const zero = Money.zero(input.currency);
    const lines: EntryLineInput[] = [];
    for (const method of TENDER_METHODS) {
      const received = input.tenders.filter((tender) => tender.method === method).reduce((sum, tender) => sum.add(tender.amount), zero);
      const net = method === "CASH" ? received.subtract(change) : received;
      if (!net.isZero()) {
        lines.push({ account: this.options.accounts.tenders[method], side: "DEBIT", amount: net });
      }
    }
    const revenue = new Map<string, Money>();
    for (const line of priced.lines) {
      revenue.set(line.revenueAccount, (revenue.get(line.revenueAccount) ?? zero).add(line.net));
    }
    for (const [account, amount] of revenue) {
      if (!amount.isZero()) {
        lines.push({ account, side: "CREDIT", amount });
      }
    }
    if (!priced.tax.isZero()) {
      lines.push({ account: this.options.accounts.taxPayable, side: "CREDIT", amount: priced.tax });
    }
    return this.options.ledger.post({
      reference: `POS-SALE/${input.id}`,
      date: input.date,
      currency: input.currency,
      memo: `POS sale ${number}`,
      lines,
    });
  }
}

/** One issue line per stock item on the sale. Each keeps a reference of its own, so a retry is recognised. */
function stockLines(input: SaleInput, priced: PricedSale): IssueLine[] {
  return priced.lines.flatMap((line, index) =>
    line.tracked
      ? [{ warehouse: input.warehouse, item: line.itemCode, qty: line.qty, reference: `POS-${input.id}/L${index + 1}` }]
      : [],
  );
}
