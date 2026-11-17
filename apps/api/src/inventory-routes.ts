import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { AuditLog } from "@erp/audit";
import { hasPermission, type Principal } from "@erp/identity";
import { Inventory, type Batch, type BatchStatus, type ExpiryReport, type InventoryAccounts, type StockResult } from "@erp/inventory";
import { Ledger } from "@erp/ledger";
import { Money } from "@erp/money";
import { DomainError, type Clock } from "@erp/kernel";
import { assertEntitled, type Company } from "@erp/tenancy";
import {
  PgAuditStore,
  PgInventoryStore,
  PgLedgerStore,
  PgTenantRepository,
  listEntitlements,
  withTenantTransaction,
  type Pool,
} from "@erp/db";

const DATE = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a YYYY-MM-DD date");
/** Whole units, sent as a decimal string so no float is involved. */
const WHOLE = z.string().regex(/^[1-9]\d{0,17}$/, "Quantity must be a whole number above zero");
/** Money as a decimal string in the company's base currency. */
const AMOUNT = z.string().regex(/^\d+(\.\d+)?$/, "Amount must be a decimal number");
const ACCOUNT = z.string().min(1).max(20);
const REFERENCE = z.string().min(1).max(100);

/** The ledger accounts a stock movement posts to, named by the caller as the sales routes do for receivables. */
const AccountsBody = z.object({
  inventory: ACCOUNT,
  clearing: ACCOUNT,
  cogs: ACCOUNT,
  writeOff: ACCOUNT,
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

const WriteOffBody = z.object({
  companyId: z.uuid(),
  warehouse: z.string().min(1).max(60),
  item: z.string().min(1).max(60),
  date: DATE,
  reference: REFERENCE,
  accounts: AccountsBody,
});

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
 * Stock by batch with expiry (INV-01, INV-03) and the pharmacy expiry reports built on it. Each route
 * needs a signed-in user, the permission for the action, and the FIN-01, INV-01 and INV-03 products.
 * A stock movement, its ledger entry and its audit entry are written in one transaction.
 */
export function registerInventoryRoutes(app: FastifyInstance, deps: InventoryRouteDeps): void {
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

  /** Writes off only batches that have expired by the date. Nothing expired gives an empty result, not an error. */
  app.post("/v1/inventory/write-offs", async (request, reply) => {
    const body = WriteOffBody.parse(request.body);
    const written = await withStock(request, "inv.stock.writeoff", body.companyId, async (context) => {
      const result = await inventoryFor(context, body.companyId, body.accounts).writeOffExpired({
        companyId: body.companyId,
        warehouse: body.warehouse,
        item: body.item,
        date: body.date,
        reference: body.reference,
      });
      if (!result) {
        return { allocations: [], cost: Money.zero(context.company.baseCurrency), entry: null } satisfies StockResult;
      }
      await context.audit.record({
        tenantId: context.tenantId,
        actorId: context.principal.userId,
        action: "WRITE_OFF",
        entityType: "stock_writeoff",
        entityId: body.reference,
        after: { item: body.item, warehouse: body.warehouse, qty: result.allocations.reduce((sum, a) => sum + a.qty, 0n).toString(), cost: result.cost.toDecimal(), batches: result.allocations.map((a) => a.batchNo) },
      });
      return result;
    });
    return reply.status(201).send(stockJson(written));
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
