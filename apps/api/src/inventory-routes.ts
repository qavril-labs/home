import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { AuditLog } from "@erp/audit";
import { ApprovalQueue } from "@erp/approvals";
import { hasPermission, type Principal } from "@erp/identity";
import {
  Inventory,
  receiptsFromCsv,
  type Batch,
  type BatchStatus,
  type ExpiryReport,
  type ImportReport,
  type InventoryAccounts,
  type StockCount,
  type StockResult,
} from "@erp/inventory";
import { Ledger } from "@erp/ledger";
import { Money } from "@erp/money";
import { DomainError, type Clock } from "@erp/kernel";
import { assertEntitled, type Company } from "@erp/tenancy";
import {
  PgApprovalStore,
  PgAuditStore,
  PgInventoryStore,
  PgLedgerStore,
  PgTenantRepository,
  listEntitlements,
  withTenantTransaction,
  type Pool,
} from "@erp/db";
import { INVENTORY_WRITE_OFF, STOCK_COUNT_APPLY } from "./approval-executors";

const DATE = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a YYYY-MM-DD date");
/** Whole units, sent as a decimal string so no float is involved. */
const WHOLE = z.string().regex(/^[1-9]\d{0,17}$/, "Quantity must be a whole number above zero");
const COUNTED = z.string().regex(/^\d{1,18}$/, "A counted quantity is a whole number, zero or more");
/** Money as a decimal string in the company's base currency. */
const AMOUNT = z.string().regex(/^\d+(\.\d+)?$/, "Amount must be a decimal number");
const ACCOUNT = z.string().min(1).max(20);
const REFERENCE = z.string().min(1).max(100);
const REASON = z.string().min(10, "A reason of at least 10 characters is needed for approval").max(500);

/** The ledger accounts a stock movement posts to, named by the caller as the sales routes do for receivables. */
const AccountsBody = z.object({
  inventory: ACCOUNT,
  clearing: ACCOUNT,
  cogs: ACCOUNT,
  writeOff: ACCOUNT,
  countVariance: ACCOUNT.optional(),
});

const ReceiptBody = z.object({
  companyId: z.uuid(),
  warehouse: z.string().min(1).max(60),
  item: z.string().min(1).max(60),
  batchNo: z.string().min(1).max(60),
  expiresOn: DATE.nullable().optional(),
  qty: WHOLE,
  unitCost: AMOUNT,
  date: DATE,
  reference: REFERENCE,
  accounts: AccountsBody,
});

const IssueBody = z.object({
  companyId: z.uuid(),
  warehouse: z.string().min(1).max(60),
  item: z.string().min(1).max(60),
  qty: WHOLE,
  date: DATE,
  reference: REFERENCE,
  accounts: AccountsBody,
});

/** A write-off is requested here and carried out only when a second person approves it. */
const WriteOffBody = z.object({
  companyId: z.uuid(),
  warehouse: z.string().min(1).max(60),
  item: z.string().min(1).max(60),
  date: DATE,
  reference: REFERENCE,
  reason: REASON,
  accounts: AccountsBody,
});

const TransferBody = z.object({
  companyId: z.uuid(),
  fromWarehouse: z.string().min(1).max(60),
  toWarehouse: z.string().min(1).max(60),
  item: z.string().min(1).max(60),
  qty: WHOLE,
  date: DATE,
  reference: REFERENCE,
});

const CountBody = z.object({
  companyId: z.uuid(),
  warehouse: z.string().min(1).max(60),
  date: DATE,
});

const CountLineBody = z.object({
  companyId: z.uuid(),
  batchId: z.uuid(),
  counted: COUNTED,
});

/** A submitted count changes stock only after a second person approves it, so the reason is required here too. */
const CountSubmitBody = z.object({
  companyId: z.uuid(),
  reason: REASON,
  accounts: AccountsBody,
});

const CompanyBody = z.object({ companyId: z.uuid() });
const CountParams = z.object({ id: z.uuid() });

const BatchesQuery = z.object({
  companyId: z.uuid(),
  warehouse: z.string().max(60).optional(),
  item: z.string().max(60).optional(),
});

const ExpiryQuery = z.object({
  companyId: z.uuid(),
  asOf: DATE,
  withinDays: z.coerce.number().int().min(0).max(3650).default(30),
});

const ImportQuery = z.object({
  companyId: z.uuid(),
  /** Defaults to a dry run, so a file is checked before anything is written. */
  dryRun: z.enum(["true", "false"]).default("true"),
  inventory: ACCOUNT,
  clearing: ACCOUNT,
  cogs: ACCOUNT,
  writeOff: ACCOUNT,
  countVariance: ACCOUNT.optional(),
});

/** A date after every posting, used to read the stock account's balance at the time of the import. */
const ALL_TIME = "2999-12-31";

export interface InventoryRouteDeps {
  readonly pool: Pool;
  readonly clock: Clock;
  readonly authenticate: (request: FastifyRequest) => Promise<Principal>;
}

type Transaction = Parameters<Parameters<typeof withTenantTransaction>[2]>[0];

interface StockContext {
  readonly tx: Transaction;
  readonly tenantId: string;
  readonly principal: Principal;
  readonly company: Company;
  readonly clock: Clock;
  readonly audit: AuditLog;
}

/**
 * Stock by batch with expiry (INV-01, INV-03), transfers (INV-02), stock counts (INV-09), CSV import, and the
 * pharmacy expiry reports. Each route needs a signed-in user, the permission for the action, and the FIN-01,
 * INV-01 and INV-03 products. Stock movements, their ledger entries and their audit entries are written in one
 * transaction. Write-offs and count adjustments change stock only once a second person approves them.
 */
export function registerInventoryRoutes(app: FastifyInstance, deps: InventoryRouteDeps): void {
  // The import takes a CSV file as the raw request body.
  app.addContentTypeParser(["text/csv", "text/plain"], { parseAs: "string" }, (_request, body, done) => {
    done(null, body);
  });

  async function withStock<T>(
    request: FastifyRequest,
    permission: string,
    companyId: string,
    work: (context: StockContext) => Promise<T>,
  ): Promise<T> {
    const principal = await deps.authenticate(request);
    if (!hasPermission(principal.permissions, permission)) {
      throw new DomainError("FORBIDDEN", `Missing permission ${permission}`);
    }
    return withTenantTransaction(deps.pool, principal.tenantId, async (tx) => {
      const entitlements = await listEntitlements(tx);
      assertEntitled(entitlements, "FIN-01");
      assertEntitled(entitlements, "INV-01");
      assertEntitled(entitlements, "INV-03");
      const company = await new PgTenantRepository(tx).findCompany(companyId);
      if (!company) {
        throw new DomainError("NOT_FOUND", "Company not found");
      }
      return work({
        tx,
        tenantId: principal.tenantId,
        principal,
        company,
        clock: deps.clock,
        audit: new AuditLog(new PgAuditStore(tx), deps.clock),
      });
    });
  }

  /** Inventory for one request. Pass accounts to post stock values to the ledger; leave them out to read only. */
  function inventoryFor(context: StockContext, companyId: string, accounts?: InventoryAccounts): Inventory {
    const store = new PgInventoryStore(context.tx, context.tenantId, companyId);
    if (!accounts) {
      return new Inventory({ store, clock: context.clock });
    }
    const ledger = new Ledger(new PgLedgerStore(context.tx, context.tenantId), companyId, context.company.baseCurrency, context.clock);
    return new Inventory({ store, posting: { ledger, accounts }, clock: context.clock });
  }

  /** The approval queue, inside the request's transaction, so a request and its audit entry commit together. */
  function queueFor(context: StockContext): ApprovalQueue {
    return new ApprovalQueue(new PgApprovalStore(context.tx, context.tenantId), context.clock);
  }

  app.post("/v1/inventory/receipts", async (request, reply) => {
    const body = ReceiptBody.parse(request.body);
    const batch = await withStock(request, "inv.stock.receive", body.companyId, async (context) => {
      const received = await inventoryFor(context, body.companyId, body.accounts).receive({
        companyId: body.companyId,
        warehouse: body.warehouse,
        item: body.item,
        batchNo: body.batchNo,
        expiresOn: body.expiresOn ?? null,
        qty: BigInt(body.qty),
        unitCost: Money.fromDecimal(body.unitCost, context.company.baseCurrency),
        date: body.date,
        reference: body.reference,
      });
      await context.audit.record({
        tenantId: context.tenantId,
        actorId: context.principal.userId,
        action: "RECEIVE",
        entityType: "stock_batch",
        entityId: received.id,
        after: { item: body.item, warehouse: body.warehouse, batchNo: body.batchNo, qty: body.qty, expiresOn: body.expiresOn ?? null, reference: body.reference },
      });
      return received;
    });
    return reply.status(201).send(batchJson(batch));
  });

  app.post("/v1/inventory/issues", async (request, reply) => {
    const body = IssueBody.parse(request.body);
    const issued = await withStock(request, "inv.stock.issue", body.companyId, async (context) => {
      const result = await inventoryFor(context, body.companyId, body.accounts).issue({
        companyId: body.companyId,
        warehouse: body.warehouse,
        item: body.item,
        qty: BigInt(body.qty),
        date: body.date,
        reference: body.reference,
      });
      await context.audit.record({
        tenantId: context.tenantId,
        actorId: context.principal.userId,
        action: "ISSUE",
        entityType: "stock_issue",
        entityId: body.reference,
        after: { item: body.item, warehouse: body.warehouse, qty: body.qty, cost: result.cost.toDecimal(), batches: result.allocations.map((a) => a.batchNo) },
      });
      return result;
    });
    return reply.status(201).send(stockJson(issued));
  });

  /**
   * Requests a write-off of expired stock. Nothing moves until a second person approves the request. Asking
   * when nothing has expired is refused, so the approval queue only holds write-offs that will do something.
   */
  app.post("/v1/inventory/write-offs", async (request, reply) => {
    const body = WriteOffBody.parse(request.body);
    const approval = await withStock(request, "inv.stock.writeoff", body.companyId, async (context) => {
      const expired = (await new PgInventoryStore(context.tx, context.tenantId, body.companyId).batches(body.companyId)).filter(
        (batch) =>
          batch.warehouse === body.warehouse &&
          batch.item === body.item &&
          batch.balance > 0n &&
          batch.expiresOn !== null &&
          batch.expiresOn < body.date,
      );
      if (expired.length === 0) {
        throw new DomainError("CONFLICT", `No ${body.item} stock in ${body.warehouse} has expired by ${body.date}`);
      }
      const requested = await queueFor(context).request({
        companyId: body.companyId,
        kind: INVENTORY_WRITE_OFF,
        reason: body.reason,
        payload: {
          companyId: body.companyId,
          warehouse: body.warehouse,
          item: body.item,
          date: body.date,
          reference: body.reference,
          accounts: body.accounts,
        },
        requestedBy: context.principal.userId,
      });
      await context.audit.record({
        tenantId: context.tenantId,
        actorId: context.principal.userId,
        action: "REQUEST",
        entityType: "approval",
        entityId: requested.id,
        after: { status: requested.status, kind: requested.kind, item: body.item, warehouse: body.warehouse },
      });
      return requested;
    });
    return reply.status(202).send(approval);
  });

  app.post("/v1/inventory/transfers", async (request, reply) => {
    const body = TransferBody.parse(request.body);
    const moved = await withStock(request, "inv.stock.transfer", body.companyId, async (context) => {
      const result = await inventoryFor(context, body.companyId).transfer({
        companyId: body.companyId,
        fromWarehouse: body.fromWarehouse,
        toWarehouse: body.toWarehouse,
        item: body.item,
        qty: BigInt(body.qty),
        date: body.date,
        reference: body.reference,
      });
      await context.audit.record({
        tenantId: context.tenantId,
        actorId: context.principal.userId,
        action: "TRANSFER",
        entityType: "stock_transfer",
        entityId: body.reference,
        after: { item: body.item, from: body.fromWarehouse, to: body.toWarehouse, qty: body.qty, batches: result.allocations.map((a) => a.batchNo) },
      });
      return result;
    });
    return reply.status(201).send({
      transferred: moved.transferred.toString(),
      allocations: moved.allocations.map((allocation) => ({
        batchId: allocation.batchId,
        batchNo: allocation.batchNo,
        expiresOn: allocation.expiresOn,
        qty: allocation.qty.toString(),
        unitCost: allocation.unitCost.toJSON(),
      })),
    });
  });

  app.post("/v1/inventory/counts", async (request, reply) => {
    const body = CountBody.parse(request.body);
    const count = await withStock(request, "inv.count.manage", body.companyId, async (context) => {
      return inventoryFor(context, body.companyId).startCount({ companyId: body.companyId, warehouse: body.warehouse, date: body.date });
    });
    return reply.status(201).send(countJson(count, false));
  });

  /** Counts for the company. Expected quantities are shown only to reviewers, and only once a count is no longer open. */
  app.get("/v1/inventory/counts", async (request) => {
    const query = CompanyBody.parse(request.query);
    return withStock(request, "inv.count.manage", query.companyId, async (context) => {
      const reviewer = hasPermission(context.principal.permissions, "inv.count.review");
      const counts = await inventoryFor(context, query.companyId).counts(query.companyId);
      return counts.map((count) => countJson(count, reviewer || count.status !== "OPEN"));
    });
  });

  /** Records one batch's counted quantity. The counter never sees the expected quantity while the count is open. */
  app.post("/v1/inventory/counts/:id/lines", async (request) => {
    const { id } = CountParams.parse(request.params);
    const body = CountLineBody.parse(request.body);
    return withStock(request, "inv.count.manage", body.companyId, async (context) => {
      const count = await inventoryFor(context, body.companyId).recordCount({
        companyId: body.companyId,
        countId: id,
        batchId: body.batchId,
        counted: BigInt(body.counted),
      });
      return countJson(count, count.status !== "OPEN");
    });
  });

  /** Submits a count for approval. The adjustments are made only when a second person approves the request. */
  app.post("/v1/inventory/counts/:id/submit", async (request, reply) => {
    const { id } = CountParams.parse(request.params);
    const body = CountSubmitBody.parse(request.body);
    const result = await withStock(request, "inv.count.manage", body.companyId, async (context) => {
      const count = await inventoryFor(context, body.companyId).submitCount(body.companyId, id);
      const approval = await queueFor(context).request({
        companyId: body.companyId,
        kind: STOCK_COUNT_APPLY,
        reason: body.reason,
        payload: { companyId: body.companyId, countId: id, accounts: body.accounts },
        requestedBy: context.principal.userId,
      });
      await context.audit.record({
        tenantId: context.tenantId,
        actorId: context.principal.userId,
        action: "SUBMIT",
        entityType: "stock_count",
        entityId: id,
        after: { status: count.status, approvalId: approval.id },
      });
      return { count, approval };
    });
    return reply.status(202).send({ count: countJson(result.count, true), approval: result.approval });
  });

  app.post("/v1/inventory/counts/:id/cancel", async (request) => {
    const { id } = CountParams.parse(request.params);
    const body = CompanyBody.parse(request.body);
    return withStock(request, "inv.count.manage", body.companyId, async (context) => {
      const count = await inventoryFor(context, body.companyId).cancelCount(body.companyId, id);
      return countJson(count, true);
    });
  });

  app.get("/v1/inventory/batches", async (request) => {
    const query = BatchesQuery.parse(request.query);
    return withStock(request, "inv.report.read", query.companyId, async (context) => {
      const batches = await new PgInventoryStore(context.tx, context.tenantId, query.companyId).batches(query.companyId);
      return batches
        .filter((batch) => (!query.item || batch.item === query.item) && (!query.warehouse || batch.warehouse === query.warehouse))
        .map(batchJson);
    });
  });

  /** Pharmacy expiry report: stock already expired, and stock expiring within the window, with days left. */
  app.get("/v1/inventory/expiry", async (request) => {
    const query = ExpiryQuery.parse(request.query);
    return withStock(request, "inv.report.read", query.companyId, async (context) => {
      const report = await inventoryFor(context, query.companyId).expiryReport(query.companyId, query.asOf, query.withinDays);
      return reportJson(report);
    });
  });

  /**
   * Imports goods received, or opening stock, from a CSV body. A dry run is the default, so a file is checked
   * before it is written. A file with any bad row is not imported. An import that writes must move the stock
   * account by exactly the value of the batches it created, or it is rolled back. A repeated import creates nothing.
   */
  app.post("/v1/inventory/imports/receipts", async (request) => {
    const query = ImportQuery.parse(request.query);
    const csv = typeof request.body === "string" ? request.body : "";
    if (csv.trim() === "") {
      throw new DomainError("VALIDATION", "Send the CSV file as the request body");
    }
    const accounts: InventoryAccounts = {
      inventory: query.inventory,
      clearing: query.clearing,
      cogs: query.cogs,
      writeOff: query.writeOff,
      ...(query.countVariance ? { countVariance: query.countVariance } : {}),
    };
    return withStock(request, "inv.stock.import", query.companyId, async (context) => {
      const currency = context.company.baseCurrency;
      const parsed = receiptsFromCsv(csv, { companyId: query.companyId, currency });
      const ledger = new Ledger(new PgLedgerStore(context.tx, context.tenantId), query.companyId, currency, context.clock);
      const before = await stockAccountBalance(ledger, query.inventory, currency);
      const dryRun = query.dryRun !== "false" || parsed.errors.length > 0;
      const report: ImportReport = await inventoryFor(context, query.companyId, accounts).importReceipts(query.companyId, parsed.rows, { dryRun });

      const errors = [
        ...parsed.errors,
        ...report.errors.map((error) => ({ row: parsed.fileRows[error.row - 1] ?? error.row, message: error.message })),
      ];
      const applied = report.applied && parsed.errors.length === 0;
      const after = await stockAccountBalance(ledger, query.inventory, currency);
      const change = after.subtract(before);
      const expected = applied ? (report.createdValue ?? Money.zero(currency)) : Money.zero(currency);
      const reconciled = change.equals(expected);
      if (applied && !reconciled) {
        throw new DomainError("UNPROCESSABLE", "The stock account did not move by the value of the imported batches, so the import was not written", {
          imported: expected.toDecimal(),
          ledgerChange: change.toDecimal(),
        });
      }
      return {
        rows: report.rows,
        applied,
        created: report.created,
        repeated: report.repeated,
        errors,
        totalQty: report.totalQty.toString(),
        totalValue: report.totalValue?.toJSON() ?? null,
        createdValue: report.createdValue?.toJSON() ?? null,
        reconciliation: {
          stockAccount: query.inventory,
          before: before.toJSON(),
          after: after.toJSON(),
          change: change.toJSON(),
          expected: expected.toJSON(),
          reconciled,
        },
      };
    });
  });
}

/** Net debit balance of the stock account at the import's time. Zero when it has no entries yet. */
async function stockAccountBalance(ledger: Ledger, account: string, currency: string): Promise<Money> {
  const row = (await ledger.trialBalance(ALL_TIME)).rows.find((item) => item.account === account);
  return row ? row.debit.subtract(row.credit) : Money.zero(currency);
}

/** A count for the client. Expected quantities are included only when the caller may see them. */
function countJson(count: StockCount, showExpected: boolean) {
  return {
    id: count.id,
    companyId: count.companyId,
    warehouse: count.warehouse,
    date: count.date,
    status: count.status,
    lines: count.lines.map((line) => ({
      batchId: line.batchId,
      batchNo: line.batchNo,
      item: line.item,
      expiresOn: line.expiresOn,
      unitCost: line.unitCost.toJSON(),
      counted: line.counted === null ? null : line.counted.toString(),
      ...(showExpected
        ? {
            expected: line.expected.toString(),
            variance: line.counted === null ? null : (line.counted - line.expected).toString(),
          }
        : {}),
    })),
  };
}

function batchJson(batch: Batch) {
  return {
    id: batch.id,
    companyId: batch.companyId,
    warehouse: batch.warehouse,
    item: batch.item,
    batchNo: batch.batchNo,
    expiresOn: batch.expiresOn,
    receivedOn: batch.receivedOn,
    receivedQty: batch.receivedQty.toString(),
    balance: batch.balance.toString(),
    unitCost: batch.unitCost.toJSON(),
    receiptReference: batch.receiptReference,
  };
}

function stockJson(result: StockResult) {
  return {
    allocations: result.allocations.map((allocation) => ({
      batchId: allocation.batchId,
      batchNo: allocation.batchNo,
      expiresOn: allocation.expiresOn,
      qty: allocation.qty.toString(),
      unitCost: allocation.unitCost.toJSON(),
      cost: allocation.cost.toJSON(),
    })),
    cost: result.cost.toJSON(),
    entry: result.entry ? { id: result.entry.id, reference: result.entry.reference, date: result.entry.date } : null,
  };
}

function reportJson(report: ExpiryReport) {
  const status = (item: BatchStatus) => ({ batch: batchJson(item.batch), daysLeft: item.daysLeft });
  return {
    asOf: report.asOf,
    expired: report.expired.map(status),
    expiringSoon: report.expiringSoon.map(status),
    expiredValue: report.expiredValue?.toJSON() ?? null,
    expiringValue: report.expiringValue?.toJSON() ?? null,
  };
}
