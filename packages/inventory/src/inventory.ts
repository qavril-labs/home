import { DomainError, newId, systemClock, type Clock } from "@erp/kernel";
import type { Ledger, PostedEntry } from "@erp/ledger";
import { Money } from "@erp/money";
import { varianceOf, type CountLine, type StockCount } from "./counts";

/**
 * Stock by batch, with expiry (INV-01). Stock on hand is always the sum of immutable movements; no
 * balance is stored. Issues take the batch that expires first (FEFO, BAT-003), never take expired
 * stock (BAT-004), and never take a batch below zero (INV-003). Every movement carries a reference
 * (INV-004). Movements with a value are posted to the ledger inside the same unit of work. Transfers
 * between warehouses post no ledger entry, because both warehouses sit under the same stock account.
 */

/**
 * RECEIPT and TRANSFER_IN add stock; ISSUE, WRITE_OFF and TRANSFER_OUT remove it; ADJUSTMENT (from a
 * stock count) adds or removes depending on its sign.
 */
export const MOVEMENT_TYPES = ["RECEIPT", "ISSUE", "WRITE_OFF", "TRANSFER_OUT", "TRANSFER_IN", "ADJUSTMENT"] as const;
export type MovementType = (typeof MOVEMENT_TYPES)[number];
type OutboundType = "ISSUE" | "WRITE_OFF";

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
  /** Signed: positive adds stock, negative removes it. */
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
  /** Gains and losses found by stock counts. Needed only to apply a count. */
  readonly countVariance?: string;
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

export interface TransferInput {
  readonly companyId: string;
  readonly fromWarehouse: string;
  readonly toWarehouse: string;
  readonly item: string;
  readonly qty: bigint;
  readonly date: string;
  readonly reference: string;
}

export interface TransferResult {
  /** The batches the stock left, first to expire first. */
  readonly allocations: readonly Allocation[];
  readonly transferred: bigint;
}

export interface ImportRowError {
  /** 1-based number of the data row, not counting the header. */
  readonly row: number;
  readonly message: string;
}

export interface ImportReport {
  readonly rows: number;
  readonly errors: readonly ImportRowError[];
  readonly totalQty: bigint;
  /** Value of the rows at their unit cost. Null when no rows were valid. */
  readonly totalValue: Money | null;
  /** True when the rows were written. False for a dry run, or when any row failed. */
  readonly applied: boolean;
  /** Rows that created new batches. A row already imported under the same reference creates nothing. */
  readonly created: number;
  /** Rows whose reference was already imported, so they were left as they were. */
  readonly repeated: number;
  /** Value of the rows that created batches. This is what the ledger's stock account should move by. */
  readonly createdValue: Money | null;
}

export interface CountResult {
  readonly count: StockCount;
  /** Net value the adjustments added to (positive) or removed from (negative) stock. Null when nothing differed. */
  readonly netValue: Money | null;
  readonly adjustments: number;
}

/** The writes available inside one unit of stock work. */
export interface InventoryTx {
  /** Batches of the company with balances, including changes made earlier in this unit of work. */
  batches(): Promise<Batch[]>;
  /** Movements of this type already recorded under the reference, so a retry does not repeat them. */
  movementsFor(reference: string, type: MovementType): Promise<Movement[]>;
  createBatch(batch: BatchRecord, receipt: Movement): Promise<void>;
  appendMovements(movements: readonly Movement[]): Promise<void>;
  /** Every stock count of the company. */
  counts(): Promise<StockCount[]>;
  saveCount(count: StockCount): Promise<void>;
}

export interface InventoryStore {
  /**
   * Runs work with the company's stock locked, so two issues cannot both take the last unit (INV-003).
   * The Postgres store locks the company's batch rows; the memory store queues calls per company.
   */
  transaction<T>(companyId: string, work: (tx: InventoryTx) => Promise<T>): Promise<T>;
  /** Batches with balances, for reports. */
  batches(companyId: string): Promise<Batch[]>;
  /** Stock counts of the company, for listing. */
  counts(companyId: string): Promise<StockCount[]>;
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

interface CheckedReceipt {
  readonly reference: string;
  readonly batchNo: string;
  readonly expiresOn: string | null;
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
    const checked = this.checkReceipt(input);
    return this.store.transaction(input.companyId, (tx) => this.receiveIn(tx, input, checked));
  }

  /**
   * Imports receipts from a list of rows (for example, a CSV of opening stock). Every row is checked first. The
   * rows are written only when all of them are valid and this is not a dry run, and they are written in one
   * transaction, so a failed import leaves nothing behind. A repeated reference returns the batch it made.
   */
  async importReceipts(companyId: string, rows: readonly ReceiveInput[], options: { dryRun: boolean }): Promise<ImportReport> {
    const errors: ImportRowError[] = [];
    const references = new Set<string>();
    const checked: (CheckedReceipt | null)[] = rows.map((row, index) => {
      const number = index + 1;
      if (row.companyId !== companyId) {
        errors.push({ row: number, message: "Row belongs to another company" });
        return null;
      }
      try {
        const result = this.checkReceipt(row);
        if (references.has(result.reference)) {
          errors.push({ row: number, message: `Reference ${result.reference} appears more than once in the file` });
          return null;
        }
        references.add(result.reference);
        return result;
      } catch (error) {
        if (error instanceof DomainError) {
          errors.push({ row: number, message: error.message });
          return null;
        }
        throw error;
      }
    });

    const totalQty = rows.reduce((sum, row) => sum + row.qty, 0n);
    let totalValue: Money | null = null;
    try {
      totalValue = rows.reduce<Money | null>(
        (sum, row) => {
          const value = extendedValue(row.unitCost, row.qty);
          return sum ? sum.add(value) : value;
        },
        null,
      );
    } catch (error) {
      if (error instanceof DomainError) {
        errors.push({ row: 0, message: "The rows mix currencies, so their value cannot be added" });
      } else {
        throw error;
      }
    }

    const valid = errors.length === 0;
    if (!valid || options.dryRun || rows.length === 0) {
      return { rows: rows.length, errors, totalQty, totalValue, applied: false, created: 0, repeated: 0, createdValue: null };
    }
    let created = 0;
    let repeated = 0;
    let createdValue: Money | null = null;
    await this.store.transaction(companyId, async (tx) => {
      const known = new Set((await tx.batches()).map((batch) => batch.receiptReference));
      for (let index = 0; index < rows.length; index++) {
        const row = rows[index]!;
        const receipt = checked[index]!;
        if (known.has(receipt.reference)) {
          repeated += 1;
        } else {
          created += 1;
          const value = extendedValue(row.unitCost, row.qty);
          createdValue = createdValue ? createdValue.add(value) : value;
        }
        await this.receiveIn(tx, row, receipt);
      }
    });
    return { rows: rows.length, errors: [], totalQty, totalValue, applied: true, created, repeated, createdValue };
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
      const expired = fefoOrder(expiredBatchesOf(batches, input.warehouse, input.item, input.date));
      if (expired.length === 0) return null;
      const allocations = expired.map((batch) => toAllocation(batch, batch.balance));
      return this.commit(tx, { ...input, reference }, allocations, "WRITE_OFF");
    });
  }

  /**
   * Moves stock from one warehouse to another, first to expire first. The batch number, expiry and unit cost
   * travel with the stock, so a batch stays the same batch in the new warehouse. No ledger entry is posted.
   * A repeat of the same reference returns what the first attempt moved.
   */
  async transfer(input: TransferInput): Promise<TransferResult> {
    const reference = assertReference(input.reference);
    assertWhole(input.qty);
    assertDate(input.date, "Transfer date");
    if (input.fromWarehouse === input.toWarehouse) {
      throw new DomainError("VALIDATION", "A transfer needs two different warehouses");
    }
    return this.store.transaction(input.companyId, async (tx) => {
      const batches = await tx.batches();
      const prior = await tx.movementsFor(reference, "TRANSFER_OUT");
      if (prior.length > 0) {
        const byId = new Map(batches.map((batch) => [batch.id, batch] as const));
        const allocations = prior.map((movement) => {
          const batch = byId.get(movement.batchId);
          if (!batch || batch.warehouse !== input.fromWarehouse || batch.item !== input.item) {
            throw new DomainError("CONFLICT", `Reference ${reference} was already used for a different transfer`);
          }
          return toAllocation(batch, -movement.qty);
        });
        const moved = allocations.reduce((sum, allocation) => sum + allocation.qty, 0n);
        if (moved !== input.qty) {
          throw new DomainError("CONFLICT", `Reference ${reference} was already used for a different quantity`);
        }
        return { allocations, transferred: moved };
      }

      const allocations = allocateFefo(batches, input.fromWarehouse, input.item, input.qty, input.date);
      const now = this.clock.now();
      const postedAt = now.toISOString();
      const outs: Movement[] = [];
      const arrivals: { batch: BatchRecord; receipt: Movement }[] = [];
      allocations.forEach((allocation, index) => {
        const source = batches.find((batch) => batch.id === allocation.batchId);
        if (!source) {
          throw new DomainError("CONFLICT", "The source batch changed during the transfer");
        }
        outs.push({
          id: newId(now.getTime()),
          companyId: input.companyId,
          batchId: allocation.batchId,
          type: "TRANSFER_OUT",
          qty: -allocation.qty,
          date: input.date,
          reference,
          postedAt,
        });
        const batchId = newId(now.getTime());
        arrivals.push({
          batch: {
            id: batchId,
            companyId: input.companyId,
            warehouse: input.toWarehouse,
            item: input.item,
            batchNo: source.batchNo,
            expiresOn: source.expiresOn,
            receivedOn: input.date,
            receivedQty: allocation.qty,
            unitCost: source.unitCost,
            receiptReference: `${reference}/IN/${index + 1}`,
          },
          receipt: {
            id: newId(now.getTime()),
            companyId: input.companyId,
            batchId,
            type: "TRANSFER_IN",
            qty: allocation.qty,
            date: input.date,
            reference,
            postedAt,
          },
        });
      });
      await tx.appendMovements(outs);
      for (const arrival of arrivals) {
        await tx.createBatch(arrival.batch, arrival.receipt);
      }
      return { allocations, transferred: input.qty };
    });
  }

  /** Starts a stock count for a warehouse. Only one count can be open per warehouse at a time. */
  async startCount(input: { companyId: string; warehouse: string; date: string }): Promise<StockCount> {
    assertDate(input.date, "Count date");
    if (input.warehouse.trim().length === 0) {
      throw new DomainError("VALIDATION", "A count needs a warehouse");
    }
    return this.store.transaction(input.companyId, async (tx) => {
      const open = (await tx.counts()).find((count) => count.warehouse === input.warehouse && (count.status === "OPEN" || count.status === "SUBMITTED"));
      if (open) {
        throw new DomainError("CONFLICT", `A count of ${input.warehouse} is already ${open.status.toLowerCase()}`, { countId: open.id });
      }
      const lines: CountLine[] = fefoOrder((await tx.batches()).filter((batch) => batch.warehouse === input.warehouse && batch.balance > 0n)).map(
        (batch) => ({
          batchId: batch.id,
          batchNo: batch.batchNo,
          item: batch.item,
          expiresOn: batch.expiresOn,
          unitCost: batch.unitCost,
          expected: batch.balance,
          counted: null,
        }),
      );
      const count: StockCount = { id: newId(this.clock.now().getTime()), companyId: input.companyId, warehouse: input.warehouse, date: input.date, status: "OPEN", lines };
      await tx.saveCount(count);
      return count;
    });
  }

  /** Records what the counter found in one batch. Counting the same batch again replaces the figure. */
  async recordCount(input: { companyId: string; countId: string; batchId: string; counted: bigint }): Promise<StockCount> {
    if (input.counted < 0n) {
      throw new DomainError("VALIDATION", "A counted quantity cannot be negative");
    }
    return this.store.transaction(input.companyId, async (tx) => {
      const count = await requireCount(tx, input.countId);
      if (count.status !== "OPEN") {
        throw new DomainError("CONFLICT", `The count is ${count.status.toLowerCase()}, so it cannot be changed`);
      }
      if (!count.lines.some((line) => line.batchId === input.batchId)) {
        throw new DomainError("NOT_FOUND", "That batch is not on this count");
      }
      const updated: StockCount = {
        ...count,
        lines: count.lines.map((line) => (line.batchId === input.batchId ? { ...line, counted: input.counted } : line)),
      };
      await tx.saveCount(updated);
      return updated;
    });
  }

  /** Sends a count for approval. Every batch must have a counted quantity first. */
  async submitCount(companyId: string, countId: string): Promise<StockCount> {
    return this.store.transaction(companyId, async (tx) => {
      const count = await requireCount(tx, countId);
      if (count.status !== "OPEN") {
        throw new DomainError("CONFLICT", `The count is ${count.status.toLowerCase()}, so it cannot be submitted`);
      }
      if (count.lines.some((line) => line.counted === null)) {
        throw new DomainError("VALIDATION", "Every batch on the count needs a counted quantity before it is submitted");
      }
      const updated: StockCount = { ...count, status: "SUBMITTED" };
      await tx.saveCount(updated);
      return updated;
    });
  }

  /** Returns a submitted count to the counter, for example after its approval is rejected or withdrawn. */
  async reopenCount(companyId: string, countId: string): Promise<StockCount> {
    return this.store.transaction(companyId, async (tx) => {
      const count = await requireCount(tx, countId);
      if (count.status !== "SUBMITTED") {
        throw new DomainError("CONFLICT", `The count is ${count.status.toLowerCase()}, not submitted`);
      }
      const updated: StockCount = { ...count, status: "OPEN" };
      await tx.saveCount(updated);
      return updated;
    });
  }

  /** Cancels an open count. A submitted or applied count cannot be cancelled. */
  async cancelCount(companyId: string, countId: string): Promise<StockCount> {
    return this.store.transaction(companyId, async (tx) => {
      const count = await requireCount(tx, countId);
      if (count.status !== "OPEN") {
        throw new DomainError("CONFLICT", `The count is ${count.status.toLowerCase()}, so it cannot be cancelled`);
      }
      const updated: StockCount = { ...count, status: "CANCELLED" };
      await tx.saveCount(updated);
      return updated;
    });
  }

  /**
   * Applies a submitted count. Each batch that differs gets one adjustment, and its value goes to the
   * count-variance account. A batch cannot be taken below zero by an adjustment, so if stock has been sold
   * since the count started and the books cannot cover the difference, the count is refused rather than forced.
   */
  async applyCount(companyId: string, countId: string): Promise<CountResult> {
    return this.store.transaction(companyId, async (tx) => {
      const count = await requireCount(tx, countId);
      if (count.status !== "SUBMITTED") {
        throw new DomainError("CONFLICT", `The count is ${count.status.toLowerCase()}, not submitted, so it cannot be applied`);
      }
      const byId = new Map((await tx.batches()).map((batch) => [batch.id, batch] as const));
      const now = this.clock.now();
      const postedAt = now.toISOString();
      const adjustments: Movement[] = [];
      let netValue: Money | null = null;
      for (const line of count.lines) {
        const variance = varianceOf(line);
        if (variance === 0n) continue;
        const batch = byId.get(line.batchId);
        if (!batch) {
          throw new DomainError("CONFLICT", `Batch ${line.batchNo} no longer exists`);
        }
        if (batch.balance + variance < 0n) {
          throw new DomainError("UNPROCESSABLE", `Stock of ${batch.item} batch ${batch.batchNo} has moved since the count, so the count cannot be applied as taken`, {
            batchNo: batch.batchNo,
            onHand: batch.balance.toString(),
            variance: variance.toString(),
          });
        }
        const value = extendedValue(line.unitCost, variance < 0n ? -variance : variance);
        if (this.posting && !value.isZero()) {
          const countVariance = this.posting.accounts.countVariance;
          if (!countVariance) {
            throw new DomainError("VALIDATION", "Applying a count needs the count-variance account");
          }
          const gained = variance > 0n;
          await this.posting.ledger.post({
            reference: `COUNT-${count.id}/${batch.id}`,
            date: count.date,
            currency: value.currency,
            memo: `Count ${gained ? "gain" : "loss"} of ${batch.item} batch ${batch.batchNo} in ${count.warehouse}`,
            lines: [
              { account: gained ? this.posting.accounts.inventory : countVariance, side: "DEBIT", amount: value },
              { account: gained ? countVariance : this.posting.accounts.inventory, side: "CREDIT", amount: value },
            ],
          });
          netValue = netValue ? netValue.add(gained ? value : value.negate()) : gained ? value : value.negate();
        }
        adjustments.push({
          id: newId(now.getTime()),
          companyId,
          batchId: line.batchId,
          type: "ADJUSTMENT",
          qty: variance,
          date: count.date,
          reference: `COUNT-${count.id}`,
          postedAt,
        });
      }
      await tx.appendMovements(adjustments);
      const applied: StockCount = { ...count, status: "APPLIED" };
      await tx.saveCount(applied);
      return { count: applied, netValue, adjustments: adjustments.length };
    });
  }

  /** Stock counts of the company, for listing. Expected quantities are included, so callers decide whom to show them to. */
  async counts(companyId: string): Promise<StockCount[]> {
    return this.store.counts(companyId);
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

  /** Checks a receipt without writing it. Throws a validation error for the first problem found. */
  checkReceipt(input: ReceiveInput): CheckedReceipt {
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
    return { reference, batchNo, expiresOn };
  }

  /** Writes a receipt inside a unit of work the caller already holds. */
  private async receiveIn(tx: InventoryTx, input: ReceiveInput, checked: CheckedReceipt): Promise<Batch> {
    const { reference, batchNo, expiresOn } = checked;
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

async function requireCount(tx: InventoryTx, countId: string): Promise<StockCount> {
  const count = (await tx.counts()).find((item) => item.id === countId);
  if (!count) {
    throw new DomainError("NOT_FOUND", "Stock count not found");
  }
  return count;
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

function expiredBatchesOf(batches: readonly Batch[], warehouse: string, item: string, date: string): Batch[] {
  return batches.filter(
    (batch) =>
      batch.warehouse === warehouse &&
      batch.item === item &&
      batch.balance > 0n &&
      batch.expiresOn !== null &&
      batch.expiresOn < date,
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
