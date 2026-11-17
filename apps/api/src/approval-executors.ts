import { z } from "zod";
import { AuditLog } from "@erp/audit";
import type { ApprovalRequest } from "@erp/approvals";
import { DomainError, type Clock } from "@erp/kernel";
import { Inventory, type InventoryAccounts } from "@erp/inventory";
import { Ledger } from "@erp/ledger";
import { PgAuditStore, PgInventoryStore, PgLedgerStore, PgTenantRepository, type Queryable } from "@erp/db";

/**
 * Approval kinds that carry out an action when they are approved. A write-off and a stock count adjustment
 * do not change stock when they are requested. They change it only when a second person approves, inside the
 * same transaction as the approval, so a refused action leaves the request pending rather than half done.
 * Rejecting or withdrawing a count releases it back to the counter.
 */
export const INVENTORY_WRITE_OFF = "INVENTORY_WRITE_OFF";
export const STOCK_COUNT_APPLY = "STOCK_COUNT_APPLY";
/** A bill discount above the threshold. Approval is the sign-off itself; nothing is executed. */
export const POS_BILL_DISCOUNT = "POS_BILL_DISCOUNT";

export interface ApprovalEffectContext {
  readonly tx: Queryable;
  readonly tenantId: string;
  readonly clock: Clock;
  /** The person who decided the request. */
  readonly actorId: string;
}

const Accounts = z.object({
  inventory: z.string().min(1).max(20),
  clearing: z.string().min(1).max(20),
  cogs: z.string().min(1).max(20),
  writeOff: z.string().min(1).max(20),
  countVariance: z.string().min(1).max(20).optional(),
});

const WriteOffPayload = z.object({
  companyId: z.uuid(),
  warehouse: z.string().min(1).max(60),
  item: z.string().min(1).max(60),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reference: z.string().min(1).max(100),
  accounts: Accounts,
});

const CountPayload = z.object({
  companyId: z.uuid(),
  countId: z.uuid(),
  accounts: Accounts,
});

async function inventoryFor(ctx: ApprovalEffectContext, companyId: string, accounts: InventoryAccounts): Promise<Inventory> {
  const company = await new PgTenantRepository(ctx.tx).findCompany(companyId);
  if (!company) {
    throw new DomainError("NOT_FOUND", "Company not found");
  }
  const ledger = new Ledger(new PgLedgerStore(ctx.tx, ctx.tenantId), companyId, company.baseCurrency, ctx.clock);
  return new Inventory({ store: new PgInventoryStore(ctx.tx, ctx.tenantId, companyId), posting: { ledger, accounts }, clock: ctx.clock });
}

/**
 * Carries out the action an approval asks for. Returns what happened, to be sent back with the approval, or
 * undefined when the kind has no action to carry out.
 */
export async function executeApproval(ctx: ApprovalEffectContext, request: ApprovalRequest): Promise<Record<string, unknown> | undefined> {
  if (request.kind === INVENTORY_WRITE_OFF) {
    const payload = WriteOffPayload.parse(request.payload);
    const inventory = await inventoryFor(ctx, payload.companyId, payload.accounts);
    const result = await inventory.writeOffExpired({
      companyId: payload.companyId,
      warehouse: payload.warehouse,
      item: payload.item,
      date: payload.date,
      reference: payload.reference,
    });
    await new AuditLog(new PgAuditStore(ctx.tx), ctx.clock).record({
      tenantId: ctx.tenantId,
      actorId: ctx.actorId,
      action: "WRITE_OFF",
      entityType: "stock_writeoff",
      entityId: payload.reference,
      after: {
        item: payload.item,
        warehouse: payload.warehouse,
        written: result !== null,
        cost: result ? result.cost.toDecimal() : "0.00",
        batches: result ? result.allocations.map((allocation) => allocation.batchNo) : [],
      },
    });
    return {
      written: result !== null,
      cost: result ? result.cost.toJSON() : null,
      batches: result ? result.allocations.map((allocation) => allocation.batchNo) : [],
    };
  }

  if (request.kind === STOCK_COUNT_APPLY) {
    const payload = CountPayload.parse(request.payload);
    const inventory = await inventoryFor(ctx, payload.companyId, payload.accounts);
    const applied = await inventory.applyCount(payload.companyId, payload.countId);
    await new AuditLog(new PgAuditStore(ctx.tx), ctx.clock).record({
      tenantId: ctx.tenantId,
      actorId: ctx.actorId,
      action: "COUNT_APPLIED",
      entityType: "stock_count",
      entityId: payload.countId,
      after: { status: applied.count.status, adjustments: applied.adjustments, netValue: applied.netValue?.toDecimal() ?? "0.00" },
    });
    return {
      countStatus: applied.count.status,
      adjustments: applied.adjustments,
      netValue: applied.netValue?.toJSON() ?? null,
    };
  }

  return undefined;
}

/** Releases what a request was holding when it is rejected or withdrawn. A count goes back to the counter. */
export async function releaseApproval(ctx: ApprovalEffectContext, request: ApprovalRequest): Promise<void> {
  if (request.kind === STOCK_COUNT_APPLY) {
    const payload = CountPayload.parse(request.payload);
    const inventory = await inventoryFor(ctx, payload.companyId, payload.accounts);
    await inventory.reopenCount(payload.companyId, payload.countId);
  }
}
