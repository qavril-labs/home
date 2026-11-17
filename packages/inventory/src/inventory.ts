import { DomainError, newId, systemClock, type Clock } from "@erp/kernel";
import type { Ledger, PostedEntry } from "@erp/ledger";
import { Money } from "@erp/money";

/**
 * Stock by batch, with expiry (INV-01). Stock on hand is always the sum of immutable movements; no
 * balance is stored. Issues take the batch that expires first (FEFO, BAT-003), never take expired
 * stock (BAT-004), and never take a batch below zero (INV-003). Every movement carries a reference
 * (INV-004). Movements with a value are posted to the ledger inside the same unit of work.
 */

export type MovementType = "RECEIPT" | "ISSUE" | "WRITE_OFF";
type OutboundType = Exclude<MovementType, "RECEIPT">;

export interface BatchRecord {
  readonly id: string;
  readonly companyId: string;
  readonly warehouse: string;
  readonly item: string;
  readonly batchNo: string;
  /** YYYY-MM-DD, or null for items without an expiry date (BAT-002). */
  readonly expiresOn: string | null;
  readonly receivedOn: string;
  readonly receivedQty: bigint;
  readonly unitCost: Money;
  readonly receiptReference: string;
}

export interface Batch extends BatchRecord {
  /** Derived from the movements of the batch. Never stored. */
  readonly balance: bigint;
}

export interface Movement {
  readonly id: string;
  readonly companyId: string;
  readonly batchId: string;
  readonly type: MovementType;
  /** Signed: positive for receipts, negative for issues and write-offs. */
  readonly qty: bigint;
  readonly date: string;
  readonly reference: string;
  readonly postedAt: string;
}

export interface Allocation {
  readonly batchId: string;
  readonly batchNo: string;
  readonly expiresOn: string | null;
  /** Whole units taken from the batch, always positive. */
  readonly qty: bigint;
  readonly unitCost: Money;
  readonly cost: Money;
}

export interface StockResult {
  readonly allocations: readonly Allocation[];
  readonly cost: Money;
  /** The ledger entry for the movement, or null when the stock had no value to post. */
  readonly entry: PostedEntry | null;
}

export interface BatchStatus {
  readonly batch: Batch;
  /** Negative when the batch has already expired. */
  readonly daysLeft: number;
}

export interface ExpiryReport {
  readonly asOf: string;
  readonly expired: readonly BatchStatus[];
  readonly expiringSoon: readonly BatchStatus[];
  /** Cost of the balance still on hand in expired batches, or null when none. */
  readonly expiredValue: Money | null;
  /** Cost of the balance still on hand in batches expiring within the window, or null when none. */
  readonly expiringValue: Money | null;
}

export interface InventoryAccounts {
  /** Stock on hand (asset). */
  readonly inventory: string;
  /** Goods received but not yet invoiced by the supplier. */
  readonly clearing: string;
  /** Cost of goods sold. */
  readonly cogs: string;
  /** Expense for expired or damaged stock written off. */
  readonly writeOff: string;
}

export interface ReceiveInput {
  readonly companyId: string;
  readonly warehouse: string;
  readonly item: string;
  readonly batchNo: string;
  readonly expiresOn?: string | null;
  readonly qty: bigint;
  readonly unitCost: Money;
  readonly date: string;
  readonly reference: string;
}

export interface IssueInput {
  readonly companyId: string;
  readonly warehouse: string;
  readonly item: string;
  readonly qty: bigint;
  readonly date: string;
  readonly reference: string;
}

export interface IssueLine {
  readonly warehouse: string;
  readonly item: string;
  readonly qty: bigint;
  /** Unique for each line, so each line can be retried safely. */
  readonly reference: string;
}

export interface IssueManyInput {
  readonly companyId: string;
  readonly date: string;
  readonly lines: readonly IssueLine[];
}

export interface WriteOffInput {
  readonly companyId: string;
  readonly warehouse: string;
  readonly item: string;
  readonly date: string;
  readonly reference: string;
}

/** The writes available inside one unit of stock work. */
export interface InventoryTx {
  /** Batches of the company with balances, including changes made earlier in this unit of work. */
  batches(): Promise<Batch[]>;
  /** Movements of this type already recorded under the reference, so a retry does not repeat them. */
  movementsFor(reference: string, type: MovementType): Promise<Movement[]>;
  createBatch(batch: BatchRecord, receipt: Movement): Promise<void>;
  appendMovements(movements: readonly Movement[]): Promise<void>;
}

export interface InventoryStore {
  /**
   * Runs work with the company's stock locked, so two issues cannot both take the last unit (INV-003).
   * The Postgres store locks the company's batch rows; the memory store queues calls per company.
   */
  transaction<T>(companyId: string, work: (tx: InventoryTx) => Promise<T>): Promise<T>;
  /** Batches with balances, for reports. */
  batches(companyId: string): Promise<Batch[]>;
}

export interface InventoryOptions {
  readonly store: InventoryStore;
  /** When given, stock with a value is posted to the ledger. */
  readonly posting?: { readonly ledger: Ledger; readonly accounts: InventoryAccounts };
  /** Items whose batches must carry an expiry date (BAT-002). Defaults to none. */
  readonly expiryRequired?: (item: string) => boolean;
  readonly clock?: Clock;
}

interface Scope {
  readonly companyId: string;
  readonly warehouse: string;
  readonly item: string;
  readonly date: string;
  readonly reference: string;
}

export class Inventory {
  private readonly store: InventoryStore;
  private readonly posting: InventoryOptions["posting"];
  private readonly expiryRequired: (item: string) => boolean;
  private readonly clock: Clock;

  constructor(options: InventoryOptions) {
    this.store = options.store;
    this.posting = options.posting;
    this.expiryRequired = options.expiryRequired ?? (() => false);
    this.clock = options.clock ?? systemClock;
  }

  /** Stock comes in as a new batch. A repeat of the same reference returns the batch it made. */
  async receive(input: ReceiveInput): Promise<Batch> {
    const reference = assertReference(input.reference);
    assertWhole(input.qty);
    assertDate(input.date, "Receipt date");
    const batchNo = input.batchNo.trim();
    if (batchNo.length === 0) {
      throw new DomainError("VALIDATION", "Batch number is required (BAT-001)");
    }
    if (input.unitCost.isNegative()) {
      throw new DomainError("VALIDATION", "Unit cost cannot be negative");
    }
    const expiresOn = input.expiresOn ?? null;
    if (expiresOn !== null) {
      assertDate(expiresOn, "Expiry date");
      if (expiresOn < input.date) {
        throw new DomainError("VALIDATION", `Batch ${batchNo} expired on ${expiresOn} and cannot be received (BAT-004)`);
      }
    } else if (this.expiryRequired(input.item)) {
      throw new DomainError("VALIDATION", `${input.item} needs an expiry date on every batch (BAT-002)`);
    }

    return this.store.transaction(input.companyId, async (tx) => {
      const existing = (await tx.batches()).find((batch) => batch.receiptReference === reference);
      if (existing) {
        if (sameReceipt(existing, input, batchNo, expiresOn)) return existing;
        throw new DomainError("CONFLICT", `Reference ${reference} was already used for a different receipt`);
      }

      const now = this.clock.now();
      const batchId = newId(now.getTime());
      const record: BatchRecord = {
        id: batchId,
        companyId: input.companyId,
        warehouse: input.warehouse,
        item: input.item,
        batchNo,
        expiresOn,
        receivedOn: input.date,
        receivedQty: input.qty,
        unitCost: input.unitCost,
        receiptReference: reference,
      };
      const receipt: Movement = {
        id: newId(now.getTime()),
        companyId: input.companyId,
        batchId,
        type: "RECEIPT",
        qty: input.qty,
        date: input.date,
        reference,
        postedAt: now.toISOString(),
      };
      const value = extendedValue(input.unitCost, input.qty);
      if (this.posting && !value.isZero()) {
        await this.posting.ledger.post({
          reference: `${reference}/RECEIPT`,
          date: input.date,
          currency: value.currency,
          memo: `Receipt of ${input.item} batch ${batchNo} into ${input.warehouse}`,
          lines: [
            { account: this.posting.accounts.inventory, side: "DEBIT", amount: value },
            { account: this.posting.accounts.clearing, side: "CREDIT", amount: value },
          ],
        });
      }
      await tx.createBatch(record, receipt);
      return { ...record, balance: input.qty };
    });
  }

  /**
   * Takes stock first to expire first. Expired batches are never taken (BAT-004). Insufficient
   * unexpired stock is refused rather than taken negative (INV-003). Nothing is written unless all of it fits.
   */
  async issue(input: IssueInput): Promise<StockResult> {
    const reference = assertReference(input.reference);
    assertWhole(input.qty);
    assertDate(input.date, "Issue date");
    return this.store.transaction(input.companyId, async (tx) => {
      const batches = await tx.batches();
      const prior = await tx.movementsFor(reference, "ISSUE");
      if (prior.length > 0) {
        return this.replay(reference, "ISSUE", prior, batches, { warehouse: input.warehouse, item: input.item, qty: input.qty });
      }
      const allocations = allocateFefo(batches, input.warehouse, input.item, input.qty, input.date);
      return this.commit(tx, { ...input, reference }, allocations, "ISSUE");
    });
  }

  /**
   * Issues several lines as one unit, for a sale that takes stock for many items. Each line is allocated
   * against the stock left after the lines before it, and nothing is written unless every line fits, so a
   * shortage is refused with no stock moved. Each line keeps its own reference, so a retry is refused as a reuse.
   */
  async issueMany(input: IssueManyInput): Promise<StockResult[]> {
    assertDate(input.date, "Issue date");
    if (input.lines.length === 0) {
      throw new DomainError("VALIDATION", "Nothing to issue");
    }
    const lines = input.lines.map((line) => {
      assertWhole(line.qty);
      return { ...line, reference: assertReference(line.reference) };
    });
    if (new Set(lines.map((line) => line.reference)).size !== lines.length) {
      throw new DomainError("VALIDATION", "Each issued line needs its own reference");
    }
    return this.store.transaction(input.companyId, async (tx) => {
      for (const line of lines) {
        if ((await tx.movementsFor(line.reference, "ISSUE")).length > 0) {
          throw new DomainError("CONFLICT", `Reference ${line.reference} was already issued`);
        }
      }
      // Allocate every line first, against balances reduced by the lines before it. Nothing is written yet.
      let batches = await tx.batches();
      const plans: { line: (typeof lines)[number]; allocations: Allocation[] }[] = [];
      for (const line of lines) {
        const allocations = allocateFefo(batches, line.warehouse, line.item, line.qty, input.date);
        plans.push({ line, allocations });
        batches = batches.map((batch) => {
          const taken = allocations.filter((a) => a.batchId === batch.id).reduce((sum, a) => sum + a.qty, 0n);
          return taken === 0n ? batch : { ...batch, balance: batch.balance - taken };
        });
      }
      const results: StockResult[] = [];
      for (const { line, allocations } of plans) {
        results.push(
          await this.commit(tx, { companyId: input.companyId, warehouse: line.warehouse, item: line.item, date: input.date, reference: line.reference }, allocations, "ISSUE"),
        );
      }
      return results;
    });
  }

  /** Writes off expired stock in one warehouse. Only batches already expired on the date are taken. Returns null when nothing has expired. */
  async writeOffExpired(input: WriteOffInput): Promise<StockResult | null> {
    const reference = assertReference(input.reference);
    assertDate(input.date, "Write-off date");
    return this.store.transaction(input.companyId, async (tx) => {
      const batches = await tx.batches();
      const prior = await tx.movementsFor(reference, "WRITE_OFF");
      if (prior.length > 0) {
        return this.replay(reference, "WRITE_OFF", prior, batches, { warehouse: input.warehouse, item: input.item, qty: null });
      }
      const expired = fefoOrder(
        batches.filter(
          (batch) =>
            batch.warehouse === input.warehouse &&
            batch.item === input.item &&
            batch.balance > 0n &&
            batch.expiresOn !== null &&
            batch.expiresOn < input.date,
        ),
      );
      if (expired.length === 0) return null;
      const allocations = expired.map((batch) => toAllocation(batch, batch.balance));
      return this.commit(tx, { ...input, reference }, allocations, "WRITE_OFF");
    });
  }

  /** Batches still on hand, with days left to expiry: those already expired, and those expiring within the window. */
  async expiryReport(companyId: string, asOf: string, withinDays: number): Promise<ExpiryReport> {
    assertDate(asOf, "Report date");
    if (!Number.isInteger(withinDays) || withinDays < 0) {
      throw new DomainError("VALIDATION", "The expiry window must be a whole number of days, zero or more");
    }
    const expired: BatchStatus[] = [];
    const expiringSoon: BatchStatus[] = [];
    for (const batch of fefoOrder(await this.store.batches(companyId))) {
      if (batch.balance <= 0n || batch.expiresOn === null) continue;
      const daysLeft = daysBetween(asOf, batch.expiresOn);
      if (daysLeft < 0) expired.push({ batch, daysLeft });
      else if (daysLeft <= withinDays) expiringSoon.push({ batch, daysLeft });
    }
    return {
      asOf,
      expired,
      expiringSoon,
      expiredValue: valueOfBatches(expired.map((status) => status.batch)),
      expiringValue: valueOfBatches(expiringSoon.map((status) => status.batch)),
    };
  }

  /** Stock on hand for one item in one warehouse, counting only batches not expired on the date. */
  async available(companyId: string, warehouse: string, item: string, asOf: string): Promise<bigint> {
    assertDate(asOf, "Report date");
    return (await this.store.batches(companyId))
      .filter(
        (batch) =>
          batch.warehouse === warehouse &&
          batch.item === item &&
          batch.balance > 0n &&
          (batch.expiresOn === null || batch.expiresOn >= asOf),
      )
      .reduce((sum, batch) => sum + batch.balance, 0n);
  }

  /**
   * A retry of an issue or write-off returns what the first attempt did, and a reused reference
   * for different stock is refused.
   */
  private async replay(
    reference: string,
    type: OutboundType,
    prior: readonly Movement[],
    batches: readonly Batch[],
    want: { warehouse: string; item: string; qty: bigint | null },
  ): Promise<StockResult> {
    const byId = new Map(batches.map((batch) => [batch.id, batch] as const));
    const allocations: Allocation[] = prior.map((movement) => {
      const batch = byId.get(movement.batchId);
      if (!batch || batch.warehouse !== want.warehouse || batch.item !== want.item) {
        throw new DomainError("CONFLICT", `Reference ${reference} was already used for a different ${type === "ISSUE" ? "issue" : "write-off"}`);
      }
      return toAllocation(batch, -movement.qty);
    });
    const taken = allocations.reduce((sum, allocation) => sum + allocation.qty, 0n);
    if (want.qty !== null && taken !== want.qty) {
      throw new DomainError("CONFLICT", `Reference ${reference} was already used for a different quantity`);
    }
    const cost = sumCost(allocations);
    const entry =
      this.posting && !cost.isZero() ? ((await this.posting.ledger.entryByReference(`${reference}/${type}`)) ?? null) : null;
    return { allocations, cost, entry };
  }

  /** Writes the movements and posts their value. The caller holds the company's stock lock. */
  private async commit(tx: InventoryTx, scope: Scope, allocations: readonly Allocation[], type: OutboundType): Promise<StockResult> {
    const cost = sumCost(allocations);
    let entry: PostedEntry | null = null;
    if (this.posting && !cost.isZero()) {
      const account = type === "ISSUE" ? this.posting.accounts.cogs : this.posting.accounts.writeOff;
      entry = await this.posting.ledger.post({
        reference: `${scope.reference}/${type}`,
        date: scope.date,
        currency: cost.currency,
        memo: `${type === "ISSUE" ? "Issue" : "Write-off"} of ${scope.item} from ${scope.warehouse}`,
        lines: [
          { account, side: "DEBIT", amount: cost },
          { account: this.posting.accounts.inventory, side: "CREDIT", amount: cost },
        ],
      });
    }
    const now = this.clock.now();
    await tx.appendMovements(
      allocations.map((allocation) => ({
        id: newId(now.getTime()),
        companyId: scope.companyId,
        batchId: allocation.batchId,
        type,
        qty: -allocation.qty,
        date: scope.date,
        reference: scope.reference,
        postedAt: now.toISOString(),
      })),
    );
    return { allocations, cost, entry };
  }
}

function assertReference(reference: string): string {
  const trimmed = reference.trim();
  if (trimmed.length === 0 || trimmed.length > 100) {
    throw new DomainError("VALIDATION", "Every stock movement needs a reference of 1 to 100 characters (INV-004)");
  }
  return trimmed;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function assertDate(value: string, name: string): void {
  if (!DATE.test(value)) {
    throw new DomainError("VALIDATION", `${name} must be a YYYY-MM-DD date`);
  }
}

function assertWhole(qty: bigint): void {
  if (qty <= 0n) {
    throw new DomainError("VALIDATION", "Quantity must be a whole number above zero");
  }
}

function extendedValue(unitCost: Money, qty: bigint): Money {
  return Money.of(unitCost.minor * qty, unitCost.currency);
}

function toAllocation(batch: Batch, qty: bigint): Allocation {
  return {
    batchId: batch.id,
    batchNo: batch.batchNo,
    expiresOn: batch.expiresOn,
    qty,
    unitCost: batch.unitCost,
    cost: extendedValue(batch.unitCost, qty),
  };
}

/** Value of the balance still on hand in these batches, at each batch's own cost. Null for no batches. */
function valueOfBatches(batches: readonly Batch[]): Money | null {
  const first = batches[0];
  if (!first) return null;
  return batches.reduce(
    (sum, batch) => sum.add(extendedValue(batch.unitCost, batch.balance)),
    Money.zero(first.unitCost.currency),
  );
}

function sumCost(allocations: readonly Allocation[]): Money {
  return allocations.reduce((sum, allocation) => sum.add(allocation.cost), Money.zero(allocations[0]!.cost.currency));
}

function sameReceipt(existing: Batch, input: ReceiveInput, batchNo: string, expiresOn: string | null): boolean {
  return (
    existing.warehouse === input.warehouse &&
    existing.item === input.item &&
    existing.batchNo === batchNo &&
    existing.receivedQty === input.qty &&
    existing.receivedOn === input.date &&
    existing.expiresOn === expiresOn &&
    existing.unitCost.equals(input.unitCost)
  );
}

/** Batches with stock left, first to expire first. Batches without an expiry come last. */
export function fefoOrder(batches: readonly Batch[]): Batch[] {
  return [...batches].sort((a, b) => {
    if (a.expiresOn !== b.expiresOn) {
      if (a.expiresOn === null) return 1;
      if (b.expiresOn === null) return -1;
      return a.expiresOn.localeCompare(b.expiresOn);
    }
    return a.receivedOn.localeCompare(b.receivedOn) || a.id.localeCompare(b.id);
  });
}

/** Takes qty from batches of one item in one warehouse, first to expire first, skipping batches expired on the date. */
function allocateFefo(batches: readonly Batch[], warehouse: string, item: string, qty: bigint, asOf: string): Allocation[] {
  const usable = fefoOrder(
    batches.filter(
      (batch) =>
        batch.warehouse === warehouse &&
        batch.item === item &&
        batch.balance > 0n &&
        (batch.expiresOn === null || batch.expiresOn >= asOf),
    ),
  );
  const available = usable.reduce((sum, batch) => sum + batch.balance, 0n);
  if (available < qty) {
    throw new DomainError("UNPROCESSABLE", `Not enough unexpired stock of ${item} in ${warehouse}: ${available} available, ${qty} needed`, {
      available: available.toString(),
      needed: qty.toString(),
    });
  }
  const allocations: Allocation[] = [];
  let remaining = qty;
  for (const batch of usable) {
    if (remaining === 0n) break;
    const take = batch.balance < remaining ? batch.balance : remaining;
    allocations.push(toAllocation(batch, take));
    remaining -= take;
  }
  return allocations;
}

/** Whole days from one YYYY-MM-DD date to another. Negative when the second date is earlier. */
export function daysBetween(from: string, to: string): number {
  const start = Date.UTC(Number(from.slice(0, 4)), Number(from.slice(5, 7)) - 1, Number(from.slice(8, 10)));
  const end = Date.UTC(Number(to.slice(0, 4)), Number(to.slice(5, 7)) - 1, Number(to.slice(8, 10)));
  return Math.round((end - start) / 86_400_000);
}
