import { DomainError, isUuid, systemClock, type Clock } from "@erp/kernel";
import type { Inventory, IssueLine, StockResult } from "@erp/inventory";
import type { EntryLineInput, Ledger, PostedEntry } from "@erp/ledger";
import { Money } from "@erp/money";
import type { NumberingService } from "@erp/numbering";
import { checkTenders, TENDER_METHODS, type Tender, type TenderMethod } from "./payments";
import { priceSale, type PricedLine, type PricedSale, type SaleLineInput } from "./pricing";
import type { PosDecision, PosSale, PosStore, SaleStatus } from "./store";

export const POS_SALE_SEQUENCE = "POS_SALE";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
/** A decision on a sale needs a note of this length, so the record says why. */
const MIN_REASON = 5;

export interface PosAccounts {
  /** The ledger account each payment method is received into. */
  readonly tenders: Readonly<Record<TenderMethod, string>>;
  readonly taxPayable: string;
}

export interface BillDiscountInput {
  readonly amount: Money;
  /** Why the bill is discounted (DISC-004). Required. */
  readonly reason: string;
  /** The approver who signed off the discount, when it is above the threshold (DISC-003). */
  readonly approvedBy?: string | null;
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
  readonly billDiscount?: BillDiscountInput;
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
  /** Bill discounts above this need an approver's sign-off (DISC-003). Absent means there is no threshold. */
  readonly billDiscountApprovalAbove?: Money;
}

export interface ReviewInput {
  readonly companyId: string;
  readonly saleId: string;
  readonly decidedBy: string;
  readonly decision: "POST" | "VOID";
  /** Why the sale is posted or voided. At least five characters. */
  readonly reason: string;
  /** POST only: the business date to post on. Defaults to the sale's own date, and must be in an open period. */
  readonly date?: string;
  /** POST only: the payments as reconciled. Defaults to the payments recorded with the sale. */
  readonly tenders?: readonly Tender[];
  /** POST only: the approver of a bill discount, if one was obtained since the sale was recorded. */
  readonly billDiscountApprovedBy?: string | null;
}

export interface ReviewResult {
  /** The sale with its resolution, if the decision was made. */
  readonly sale: PosSale;
  /** The decision, or null when a POST was refused. Nothing is written in that case. */
  readonly decision: PosDecision | null;
  /** Why the sale could not be posted. Empty when it was posted or voided. */
  readonly reasons: readonly string[];
}

/** What the checks found. Stock is taken only when they all pass, so a refused sale moves nothing. */
interface Attempt {
  readonly priced: PricedSale;
  readonly change: Money;
  readonly reasons: readonly string[];
  readonly stock: readonly StockResult[];
}

/**
 * Records point-of-sale sales (POS-01), online or synced from a device that was offline, and resolves the ones
 * that were kept for review. A sale is posted in full or kept for review. Posting prices the sale (discounts before
 * tax), checks the payment and the bill discount, checks that a fiscal period is open, takes stock first to expire
 * first, writes the receipt number and posts the sale to the ledger. A sale that cannot be posted as it stands is
 * kept as NEEDS_REVIEW with its reasons, and moves no stock and posts nothing. A reviewer can then post it, with
 * its payments reconciled and on an open date, or void it, and the decision is kept beside the sale.
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

    const attempt = await this.attempt(input);
    const recordedAt = this.clock.now().toISOString();
    const base = this.baseSale(input, attempt, recordedAt);

    if (attempt.reasons.length > 0) {
      const review: PosSale = {
        ...base,
        status: "NEEDS_REVIEW" satisfies SaleStatus,
        number: null,
        change: Money.zero(input.currency),
        cost: null,
        entryId: null,
        reasons: attempt.reasons,
        resolution: null,
      };
      await this.options.store.save(review);
      return { sale: review, duplicate: false };
    }

    const { number, entry } = await this.postSale(input, attempt.priced, attempt.change);
    const posted: PosSale = {
      ...base,
      status: "POSTED" satisfies SaleStatus,
      number,
      change: attempt.change,
      cost: costOf(attempt.stock, input.currency),
      entryId: entry.id,
      reasons: [],
      resolution: null,
    };
    await this.options.store.save(posted);
    return { sale: posted, duplicate: false };
  }

  /**
   * Resolves a sale that needed review. POST posts it now, against current stock, with the payments as they are
   * reconciled and on a date in an open period. If the sale still cannot be posted, nothing is written and the
   * reasons are returned. VOID records that the sale will never be posted. Either way the decision is kept beside
   * the sale, and a sale can be decided only once.
   */
  async review(input: ReviewInput): Promise<ReviewResult> {
    const reason = input.reason.trim();
    if (reason.length < MIN_REASON) {
      throw new DomainError("VALIDATION", `A decision on a sale needs a reason of at least ${MIN_REASON} characters`);
    }
    await this.options.store.lock(input.companyId, input.saleId);
    const sale = await this.options.store.find(input.companyId, input.saleId);
    if (!sale) {
      throw new DomainError("NOT_FOUND", "Sale not found");
    }
    if (sale.status !== "NEEDS_REVIEW") {
      throw new DomainError("CONFLICT", "This sale was posted, so it needs no review");
    }
    if (sale.resolution) {
      throw new DomainError("CONFLICT", `This sale was already ${sale.resolution.decision.toLowerCase()}`);
    }
    const decidedAt = this.clock.now().toISOString();

    if (input.decision === "VOID") {
      const decision: PosDecision = {
        saleId: sale.id,
        companyId: sale.companyId,
        decision: "VOIDED",
        decidedBy: input.decidedBy,
        decidedAt,
        reason,
        postedOn: null,
        number: null,
        entryId: null,
        cost: null,
        change: Money.zero(sale.currency),
        tenders: sale.tenders,
      };
      await this.options.store.saveDecision(decision);
      return { sale: { ...sale, resolution: decision }, decision, reasons: [] };
    }

    const date = input.date ?? sale.date;
    if (!DATE.test(date)) {
      throw new DomainError("VALIDATION", "Posting date must be a YYYY-MM-DD date");
    }
    const tenders = input.tenders ?? sale.tenders;
    const reposted: SaleInput = {
      id: sale.id,
      companyId: sale.companyId,
      warehouse: sale.warehouse,
      date,
      currency: sale.currency,
      lines: sale.lines.map(toSaleLine),
      tenders,
      ...(sale.billDiscount.isZero()
        ? {}
        : {
            billDiscount: {
              amount: sale.billDiscount,
              reason: sale.billDiscountReason ?? "",
              approvedBy: input.billDiscountApprovedBy ?? sale.billDiscountApprovedBy,
            },
          }),
    };
    const attempt = await this.attempt(reposted);
    if (attempt.reasons.length > 0) {
      return { sale, decision: null, reasons: attempt.reasons };
    }

    const { number, entry } = await this.postSale(reposted, attempt.priced, attempt.change);
    const decision: PosDecision = {
      saleId: sale.id,
      companyId: sale.companyId,
      decision: "POSTED",
      decidedBy: input.decidedBy,
      decidedAt,
      reason,
      postedOn: date,
      number,
      entryId: entry.id,
      cost: costOf(attempt.stock, sale.currency),
      change: attempt.change,
      tenders,
    };
    await this.options.store.saveDecision(decision);
    return { sale: { ...sale, resolution: decision }, decision, reasons: [] };
  }

  /** Sales for a company, optionally only those with one status, such as NEEDS_REVIEW for reconciliation. */
  async sales(companyId: string, status?: SaleStatus): Promise<PosSale[]> {
    return this.options.store.list(companyId, status);
  }

  /**
   * Runs every check that decides whether a sale can be posted. When they all pass, it takes the stock. When
   * any fails, it writes nothing, so the reasons can be shown and the sale kept for review.
   */
  private async attempt(input: SaleInput): Promise<Attempt> {
    const billDiscount = input.billDiscount?.amount ?? Money.zero(input.currency);
    const priced = priceSale(input.lines, input.currency, { billDiscount });
    if (priced.total.isZero()) {
      throw new DomainError("VALIDATION", "A sale needs a total above zero");
    }
    const payment = checkTenders(priced.total, input.tenders);
    const reasons: string[] = [...payment.problems];

    if (!billDiscount.isZero()) {
      if (!input.billDiscount?.reason.trim()) {
        reasons.push("DISCOUNT_REASON_MISSING");
      }
      const threshold = this.options.billDiscountApprovalAbove;
      if (threshold && billDiscount.compare(threshold) > 0 && !input.billDiscount?.approvedBy) {
        reasons.push("DISCOUNT_NEEDS_APPROVAL");
      }
    }

    // Checked before any stock moves, so a closed period leaves nothing behind.
    if (!(await this.options.ledger.isPeriodOpen(input.date))) {
      reasons.push(`PERIOD_CLOSED: no open fiscal period covers ${input.date}`);
    }

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
    return { priced, change: payment.change, reasons, stock };
  }

  private baseSale(input: SaleInput, attempt: Attempt, recordedAt: string) {
    return {
      id: input.id,
      companyId: input.companyId,
      warehouse: input.warehouse,
      date: input.date,
      currency: input.currency,
      lines: attempt.priced.lines,
      tenders: input.tenders,
      billDiscount: attempt.priced.billDiscount,
      billDiscountReason: input.billDiscount?.reason.trim() || null,
      billDiscountApprovedBy: input.billDiscount?.approvedBy ?? null,
      subtotal: attempt.priced.subtotal,
      tax: attempt.priced.tax,
      total: attempt.priced.total,
      recordedAt,
    };
  }

  /**
   * Assigns the receipt number and posts the sale. Debits each payment account with what it received, less any
   * change handed back in cash, and credits revenue by revenue account and tax payable. The debits equal the
   * credits, which equal the sale total.
   */
  private async postSale(input: SaleInput, priced: PricedSale, change: Money): Promise<{ number: string; entry: PostedEntry }> {
    const number = await this.options.numbering.next(this.options.tenantId, POS_SALE_SEQUENCE, input.date);
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
    const entry = await this.options.ledger.post({
      reference: `POS-SALE/${input.id}`,
      date: input.date,
      currency: input.currency,
      memo: `POS sale ${number}`,
      lines,
    });
    return { number, entry };
  }
}

function costOf(stock: readonly StockResult[], currency: string): Money | null {
  return stock.length > 0 ? stock.reduce((sum, result) => sum.add(result.cost), Money.zero(currency)) : null;
}

/** A stored line, turned back into the input it was priced from, so a review can price it again. */
function toSaleLine(line: PricedLine): SaleLineInput {
  return {
    itemCode: line.itemCode,
    description: line.description,
    qty: line.qty,
    unitPrice: line.unitPrice,
    discount: line.discount,
    taxRateBps: line.taxRateBps,
    taxMode: line.taxMode,
    revenueAccount: line.revenueAccount,
    tracked: line.tracked,
  };
}

/** One issue line per stock item on the sale. Each keeps a reference of its own, so a retry is recognised. */
function stockLines(input: SaleInput, priced: PricedSale): IssueLine[] {
  return priced.lines.flatMap((line, index) =>
    line.tracked
      ? [{ warehouse: input.warehouse, item: line.itemCode, qty: line.qty, reference: `POS-${input.id}/L${index + 1}` }]
      : [],
  );
}
