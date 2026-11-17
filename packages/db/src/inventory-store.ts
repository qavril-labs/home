import type { Batch, BatchRecord, CountLine, InventoryStore, InventoryTx, Movement, MovementType, StockCount } from "@erp/inventory";
import { Money } from "@erp/money";
import type { Queryable } from "./pool";

interface BatchRow {
  id: string;
  company_id: string;
  warehouse: string;
  item: string;
  batch_no: string;
  expires_on: string | null;
  received_on: string;
  received_qty: string;
  unit_cost_minor: string;
  currency: string;
  receipt_reference: string;
  balance: string;
}

interface MovementRow {
  id: string;
  company_id: string;
  batch_id: string;
  movement_type: MovementType;
  qty: string;
  movement_date: string;
  reference: string;
  posted_at: Date;
}

/** Balance = receipts plus signed issues and write-offs, summed in the database, never stored. */
const BATCH_SELECT = `
  SELECT b.id, b.company_id, b.warehouse, b.item, b.batch_no,
         b.expires_on::text AS expires_on, b.received_on::text AS received_on,
         b.received_qty::text AS received_qty, b.unit_cost_minor::text AS unit_cost_minor,
         b.currency, b.receipt_reference,
         COALESCE(SUM(m.qty), 0)::text AS balance
    FROM inventory_batches b
    LEFT JOIN inventory_movements m ON m.tenant_id = b.tenant_id AND m.batch_id = b.id
   WHERE b.tenant_id = $1 AND b.company_id = $2
   GROUP BY b.tenant_id, b.id
   ORDER BY b.received_on, b.id`;

const MOVEMENT_SELECT = `
  SELECT id, company_id, batch_id, movement_type, qty::text AS qty,
         movement_date::text AS movement_date, reference, posted_at
    FROM inventory_movements`;

function toBatch(row: BatchRow): Batch {
  const currency = row.currency.trim();
  return {
    id: row.id,
    companyId: row.company_id,
    warehouse: row.warehouse,
    item: row.item,
    batchNo: row.batch_no,
    expiresOn: row.expires_on,
    receivedOn: row.received_on,
    receivedQty: BigInt(row.received_qty),
    unitCost: Money.of(BigInt(row.unit_cost_minor), currency),
    receiptReference: row.receipt_reference,
    balance: BigInt(row.balance),
  };
}

function toMovement(row: MovementRow): Movement {
  return {
    id: row.id,
    companyId: row.company_id,
    batchId: row.batch_id,
    type: row.movement_type,
    qty: BigInt(row.qty),
    date: row.movement_date,
    reference: row.reference,
    postedAt: row.posted_at.toISOString(),
  };
}

async function loadBatches(db: Queryable, tenantId: string, companyId: string): Promise<Batch[]> {
  const { rows } = await db.query<BatchRow>(BATCH_SELECT, [tenantId, companyId]);
  return rows.map(toBatch);
}

/**
 * Inventory storage in Postgres. Create it from a tenant transaction (withTenantTransaction), so every
 * query is limited by row-level security to that tenant, and so the lock taken in `transaction` is held
 * until the caller's transaction ends.
 */
export class PgInventoryStore implements InventoryStore {
  constructor(
    private readonly db: Queryable,
    private readonly tenantId: string,
    private readonly companyId: string,
  ) {}

  async batches(companyId: string): Promise<Batch[]> {
    assertCompany(companyId, this.companyId);
    return loadBatches(this.db, this.tenantId, this.companyId);
  }

  async counts(companyId: string): Promise<StockCount[]> {
    assertCompany(companyId, this.companyId);
    return loadCounts(this.db, this.tenantId, this.companyId);
  }

  /**
   * Takes a transaction-scoped lock for the company, so stock work for one company runs one call at a
   * time (INV-003). The lock is released when the surrounding transaction commits or rolls back.
   */
  async transaction<T>(companyId: string, work: (tx: InventoryTx) => Promise<T>): Promise<T> {
    assertCompany(companyId, this.companyId);
    await this.db.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`inventory:${this.companyId}`]);
    return work(new PgInventoryTx(this.db, this.tenantId, this.companyId));
  }
}

class PgInventoryTx implements InventoryTx {
  constructor(
    private readonly db: Queryable,
    private readonly tenantId: string,
    private readonly companyId: string,
  ) {}

  async batches(): Promise<Batch[]> {
    return loadBatches(this.db, this.tenantId, this.companyId);
  }

  async counts(): Promise<StockCount[]> {
    return loadCounts(this.db, this.tenantId, this.companyId);
  }

  /** Counts are working documents, so an open one is updated in place. The status check is in the domain. */
  async saveCount(count: StockCount): Promise<void> {
    await this.db.query(
      `INSERT INTO inventory_counts (tenant_id, id, company_id, warehouse, count_date, status, lines, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, now())
       ON CONFLICT (tenant_id, id) DO UPDATE
         SET status = EXCLUDED.status, lines = EXCLUDED.lines, updated_at = now()`,
      [this.tenantId, count.id, this.companyId, count.warehouse, count.date, count.status, JSON.stringify(count.lines.map(toCountLineJson))],
    );
  }

  async movementsFor(reference: string, type: MovementType): Promise<Movement[]> {
    const { rows } = await this.db.query<MovementRow>(
      `${MOVEMENT_SELECT}
        WHERE tenant_id = $1 AND company_id = $2 AND reference = $3 AND movement_type = $4
        ORDER BY posted_at, id`,
      [this.tenantId, this.companyId, reference, type],
    );
    return rows.map(toMovement);
  }

  async createBatch(batch: BatchRecord, receipt: Movement): Promise<void> {
    await this.db.query(
      `INSERT INTO inventory_batches (tenant_id, id, company_id, warehouse, item, batch_no, expires_on,
                                      received_on, received_qty, unit_cost_minor, currency, receipt_reference)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        this.tenantId,
        batch.id,
        this.companyId,
        batch.warehouse,
        batch.item,
        batch.batchNo,
        batch.expiresOn,
        batch.receivedOn,
        batch.receivedQty.toString(),
        batch.unitCost.minor.toString(),
        batch.unitCost.currency,
        batch.receiptReference,
      ],
    );
    await this.appendMovements([receipt]);
  }

  async appendMovements(movements: readonly Movement[]): Promise<void> {
    for (const movement of movements) {
      await this.db.query(
        `INSERT INTO inventory_movements (tenant_id, id, company_id, batch_id, movement_type, qty, movement_date, reference, posted_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          this.tenantId,
          movement.id,
          this.companyId,
          movement.batchId,
          movement.type,
          movement.qty.toString(),
          movement.date,
          movement.reference,
          movement.postedAt,
        ],
      );
    }
  }
}

interface CountLineJson {
  batchId: string;
  batchNo: string;
  item: string;
  expiresOn: string | null;
  unitCost: { amount: string; currency: string };
  expected: string;
  counted: string | null;
}

interface CountRow {
  id: string;
  warehouse: string;
  count_date: string;
  status: StockCount["status"];
  lines: CountLineJson[];
}

async function loadCounts(db: Queryable, tenantId: string, companyId: string): Promise<StockCount[]> {
  const { rows } = await db.query<CountRow>(
    `SELECT id, warehouse, count_date::text AS count_date, status, lines
       FROM inventory_counts
      WHERE tenant_id = $1 AND company_id = $2
      ORDER BY id`,
    [tenantId, companyId],
  );
  return rows.map((row) => ({
    id: row.id,
    companyId,
    warehouse: row.warehouse,
    date: row.count_date,
    status: row.status,
    lines: row.lines.map(
      (line): CountLine => ({
        batchId: line.batchId,
        batchNo: line.batchNo,
        item: line.item,
        expiresOn: line.expiresOn,
        unitCost: Money.fromDecimal(line.unitCost.amount, line.unitCost.currency),
        expected: BigInt(line.expected),
        counted: line.counted === null ? null : BigInt(line.counted),
      }),
    ),
  }));
}

function toCountLineJson(line: CountLine): CountLineJson {
  return {
    batchId: line.batchId,
    batchNo: line.batchNo,
    item: line.item,
    expiresOn: line.expiresOn,
    unitCost: line.unitCost.toJSON(),
    expected: line.expected.toString(),
    counted: line.counted === null ? null : line.counted.toString(),
  };
}

function assertCompany(requested: string, bound: string): void {
  if (requested !== bound) {
    throw new Error("Inventory store is bound to a different company");
  }
}
