import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { AuditLog } from "@erp/audit";
import { ApprovalQueue } from "@erp/approvals";
import { hasPermission, type Principal } from "@erp/identity";
import { Inventory, type InventoryAccounts } from "@erp/inventory";
import { Ledger } from "@erp/ledger";
import { Money } from "@erp/money";
import { NumberingService } from "@erp/numbering";
import {
  POS_SALE_SEQUENCE,
  PosRegister,
  TENDER_METHODS,
  checkTenders,
  priceSale,
  type PosDecision,
  type PosSale,
  type SaleInput,
  type SaleLineInput,
  type SaleStatus,
  type Tender,
} from "@erp/pos";
import { DomainError, type Clock } from "@erp/kernel";
import { assertEntitled, type Company } from "@erp/tenancy";
import {
  PgApprovalStore,
  PgAuditStore,
  PgCounterStore,
  PgInventoryStore,
  PgLedgerStore,
  PgPosStore,
  PgTenantRepository,
  listEntitlements,
  withTenantTransaction,
  type Pool,
} from "@erp/db";
import { POS_BILL_DISCOUNT } from "./approval-executors";

const DATE = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a YYYY-MM-DD date");
const WHOLE = z.string().regex(/^[1-9]\d{0,17}$/, "Quantity must be a whole number above zero");
const AMOUNT = z.string().regex(/^\d+(\.\d+)?$/, "Amount must be a decimal number");
const ACCOUNT = z.string().min(1).max(20);

const LineBody = z.object({
  itemCode: z.string().min(1).max(60),
  description: z.string().max(200).default(""),
  qty: WHOLE,
  unitPrice: AMOUNT,
  discount: AMOUNT.optional(),
  taxRateBps: z.string().regex(/^\d{1,5}$/, "Tax rate in basis points, such as 1900 for 19%"),
  taxMode: z.enum(["EXCLUSIVE", "INCLUSIVE"]),
  revenueAccount: ACCOUNT,
  tracked: z.boolean(),
});

const TenderBody = z.object({
  method: z.enum(TENDER_METHODS),
  amount: AMOUNT,
});

/** A bill discount (DISC-001 to DISC-004). The reason is required. Above the threshold it needs an approval. */
const BillDiscountBody = z.object({
  amount: AMOUNT,
  reason: z.string().min(1).max(500),
  approvalId: z.uuid().optional(),
});

const SaleBody = z.object({
  id: z.uuid(),
  warehouse: z.string().min(1).max(60),
  date: DATE,
  currency: z.string().regex(/^[A-Z]{3}$/, "Currency as a three-letter code"),
  lines: z.array(LineBody).min(1).max(200),
  tenders: z.array(TenderBody).min(1).max(10),
  billDiscount: BillDiscountBody.optional(),
});

/** The accounts a batch of sales posts to: where each payment lands, tax payable, and the stock accounts. */
const AccountsBody = z.object({
  cash: ACCOUNT,
  card: ACCOUNT,
  mobile: ACCOUNT,
  taxPayable: ACCOUNT,
  inventory: ACCOUNT,
  clearing: ACCOUNT,
  cogs: ACCOUNT,
  writeOff: ACCOUNT,
  countVariance: ACCOUNT.optional(),
});

const SyncBody = z.object({
  companyId: z.uuid(),
  accounts: AccountsBody,
  /** Bill discounts above this amount need an approval (DISC-003). Omit for no threshold. */
  discountApprovalAbove: AMOUNT.optional(),
  /** Each sale is checked on its own, so one malformed sale is reported without failing the rest. */
  sales: z.array(z.unknown()).min(1).max(200),
});

const ReviewBody = z.object({
  companyId: z.uuid(),
  decision: z.enum(["POST", "VOID"]),
  reason: z.string().min(5).max(500),
  date: DATE.optional(),
  tenders: z.array(TenderBody).min(1).max(10).optional(),
  billDiscountApprovalId: z.uuid().optional(),
  discountApprovalAbove: AMOUNT.optional(),
  accounts: AccountsBody,
});

/**
 * A price preview: the same pricing and payment rules as a sale, computed on the server so the till never does
 * money arithmetic. Nothing is written. Tenders may be empty while the cashier is still entering them.
 */
const PreviewBody = z.object({
  companyId: z.uuid(),
  warehouse: z.string().min(1).max(60),
  date: DATE,
  currency: z.string().regex(/^[A-Z]{3}$/, "Currency as a three-letter code"),
  lines: z.array(LineBody).min(1).max(200),
  tenders: z.array(TenderBody).max(10),
  billDiscount: BillDiscountBody.optional(),
  discountApprovalAbove: AMOUNT.optional(),
});

const SaleParams = z.object({ id: z.uuid() });

const SalesQuery = z.object({
  companyId: z.uuid(),
  status: z.enum(["POSTED", "NEEDS_REVIEW"]).optional(),
  /** With status NEEDS_REVIEW, true returns only the sales that no one has decided yet. */
  pending: z.enum(["true", "false"]).optional(),
});

export interface PosRouteDeps {
  readonly pool: Pool;
  readonly clock: Clock;
  readonly authenticate: (request: FastifyRequest) => Promise<Principal>;
}

/** The outcome of one synced sale. REJECTED sales are not stored, so the device keeps them and tries again. */
export interface SyncResult {
  readonly id: string;
  readonly status: SaleStatus | "REJECTED";
  readonly number: string | null;
  readonly duplicate: boolean;
  readonly reasons: readonly string[];
}

type Transaction = Parameters<Parameters<typeof withTenantTransaction>[2]>[0];
type AccountsInput = z.infer<typeof AccountsBody>;

/**
 * Point-of-sale routes (POS-01). Devices that were offline sync their sales in a batch. Each sale is posted in
 * full or kept for review, and a sale that was already synced is returned as it was stored, so a retried batch
 * never posts twice. Each sale is its own transaction, so one refused sale does not hold up the others. A sale
 * kept for review is decided later, by a person, through the review route. Needs a signed-in user, the permission
 * for the action, and the POS-01, INV-01, INV-03 and FIN-01 products.
 */
export function registerPosRoutes(app: FastifyInstance, deps: PosRouteDeps): void {
  function requirePermission(principal: Principal, permission: string): void {
    if (!hasPermission(principal.permissions, permission)) {
      throw new DomainError("FORBIDDEN", `Missing permission ${permission}`);
    }
  }

  /** Checks the products and the company in one transaction, before any sale is touched. */
  async function companyFor(principal: Principal, companyId: string): Promise<Company> {
    return withTenantTransaction(deps.pool, principal.tenantId, async (tx) => {
      const entitlements = await listEntitlements(tx);
      for (const product of ["POS-01", "INV-01", "INV-03", "FIN-01"]) {
        assertEntitled(entitlements, product);
      }
      const company = await new PgTenantRepository(tx).findCompany(companyId);
      if (!company) {
        throw new DomainError("NOT_FOUND", "Company not found");
      }
      return company;
    });
  }

  /** The register for one request, with the company's accounts and threshold. Used by sync and by review alike. */
  function registerFor(tx: Transaction, principal: Principal, companyId: string, company: Company, accounts: AccountsInput, threshold?: string): PosRegister {
    const inventoryAccounts: InventoryAccounts = {
      inventory: accounts.inventory,
      clearing: accounts.clearing,
      cogs: accounts.cogs,
      writeOff: accounts.writeOff,
      ...(accounts.countVariance ? { countVariance: accounts.countVariance } : {}),
    };
    const ledger = new Ledger(new PgLedgerStore(tx, principal.tenantId), companyId, company.baseCurrency, deps.clock);
    return new PosRegister({
      tenantId: principal.tenantId,
      store: new PgPosStore(tx, principal.tenantId),
      inventory: new Inventory({
        store: new PgInventoryStore(tx, principal.tenantId, companyId),
        posting: { ledger, accounts: inventoryAccounts },
        clock: deps.clock,
      }),
      ledger,
      numbering: new NumberingService(new PgCounterStore(tx), [{ key: POS_SALE_SEQUENCE, prefix: "POS-", padding: 6, reset: "YEARLY" }]),
      accounts: {
        tenders: { CASH: accounts.cash, CARD: accounts.card, MOBILE: accounts.mobile },
        taxPayable: accounts.taxPayable,
      },
      clock: deps.clock,
      ...(threshold ? { billDiscountApprovalAbove: Money.fromDecimal(threshold, company.baseCurrency) } : {}),
    });
  }

  /**
   * Who approved a bill discount, from an approved request of kind POS_BILL_DISCOUNT for this sale and this amount.
   * An approval for a different sale or amount does not count, so one approval cannot be reused.
   */
  async function approvedDiscountBy(tx: Transaction, tenantId: string, companyId: string, approvalId: string, saleId: string, amount: Money): Promise<string> {
    const request = await new ApprovalQueue(new PgApprovalStore(tx, tenantId), deps.clock).get(companyId, approvalId);
    if (!request) {
      throw new DomainError("NOT_FOUND", "The discount approval was not found");
    }
    if (request.kind !== POS_BILL_DISCOUNT || request.status !== "APPROVED" || !request.decidedBy) {
      throw new DomainError("VALIDATION", "The discount approval is not an approved bill discount");
    }
    const approvedAmount = typeof request.payload.amount === "string" ? request.payload.amount : "";
    const sameAmount = approvedAmount !== "" && Money.fromDecimal(approvedAmount, amount.currency).equals(amount);
    if (request.payload.saleId !== saleId || !sameAmount) {
      throw new DomainError("VALIDATION", "The discount approval is for a different sale or amount");
    }
    return request.decidedBy;
  }

  async function syncOne(principal: Principal, company: Company, body: z.infer<typeof SyncBody>, raw: unknown): Promise<SyncResult> {
    const parsed = SaleBody.safeParse(raw);
    if (!parsed.success) {
      const id = typeof (raw as { id?: unknown })?.id === "string" ? (raw as { id: string }).id : "";
      return { id, status: "REJECTED", number: null, duplicate: false, reasons: [`VALIDATION: ${parsed.error.issues[0]?.message ?? "Invalid sale"}`] };
    }
    const sale = parsed.data;
    if (sale.currency !== company.baseCurrency) {
      return rejected(sale.id, `Sales are posted in the company currency, ${company.baseCurrency}`);
    }
    try {
      return await withTenantTransaction(deps.pool, principal.tenantId, async (tx) => {
        const approvedBy =
          sale.billDiscount?.approvalId === undefined
            ? null
            : await approvedDiscountBy(
                tx,
                principal.tenantId,
                body.companyId,
                sale.billDiscount.approvalId,
                sale.id,
                Money.fromDecimal(sale.billDiscount.amount, company.baseCurrency),
              );
        const register = registerFor(tx, principal, body.companyId, company, body.accounts, body.discountApprovalAbove);
        const { sale: stored, duplicate } = await register.record(toSaleInput(sale, body.companyId, company.baseCurrency, approvedBy));
        if (!duplicate) {
          await new AuditLog(new PgAuditStore(tx), deps.clock).record({
            tenantId: principal.tenantId,
            actorId: principal.userId,
            action: "SYNC",
            entityType: "pos_sale",
            entityId: sale.id,
            after: { status: stored.status, number: stored.number, total: stored.total.toDecimal(), reasons: stored.reasons },
          });
        }
        return { id: sale.id, status: stored.status, number: stored.number, duplicate, reasons: [...stored.reasons] };
      });
    } catch (error) {
      if (error instanceof DomainError) {
        return rejected(sale.id, `${error.code}: ${error.message}`);
      }
      throw error;
    }
  }

  app.post("/v1/pos/sales/sync", async (request) => {
    const body = SyncBody.parse(request.body);
    const principal = await deps.authenticate(request);
    requirePermission(principal, "pos.sale.record");
    const company = await companyFor(principal, body.companyId);
    const results: SyncResult[] = [];
    for (const raw of body.sales) {
      results.push(await syncOne(principal, company, body, raw));
    }
    return { companyId: body.companyId, results };
  });

  /**
   * Prices a sale the cashier is still entering, without writing anything. Returns the totals, the change owed,
   * and the problems that would send the sale to review: a short payment, a bill discount needing approval, stock
   * that is not there, or a closed period. The sale itself is still checked again when it is synced.
   */
  app.post("/v1/pos/sales/price", async (request) => {
    const body = PreviewBody.parse(request.body);
    const principal = await deps.authenticate(request);
    requirePermission(principal, "pos.sale.record");
    const company = await companyFor(principal, body.companyId);
    if (body.currency !== company.baseCurrency) {
      throw new DomainError("VALIDATION", `Sales are priced in the company currency, ${company.baseCurrency}`);
    }
    const currency = company.baseCurrency;
    return withTenantTransaction(deps.pool, principal.tenantId, async (tx) => {
      const billDiscount = body.billDiscount ? Money.fromDecimal(body.billDiscount.amount, currency) : Money.zero(currency);
      const priced = priceSale(body.lines.map((line) => saleLine(line, currency)), currency, { billDiscount });
      const tenders: Tender[] = body.tenders.map((tender) => ({ method: tender.method, amount: Money.fromDecimal(tender.amount, currency) }));
      const payment = checkTenders(priced.total, tenders);
      const problems: string[] = [...payment.problems];

      if (body.billDiscount) {
        const threshold = body.discountApprovalAbove ? Money.fromDecimal(body.discountApprovalAbove, currency) : undefined;
        if (threshold && billDiscount.compare(threshold) > 0 && !body.billDiscount.approvalId) {
          problems.push("DISCOUNT_NEEDS_APPROVAL");
        }
      }

      // Stock that is not there, summed per item across the lines that take it.
      const needed = new Map<string, bigint>();
      for (const line of priced.lines) {
        if (line.tracked) needed.set(line.itemCode, (needed.get(line.itemCode) ?? 0n) + line.qty);
      }
      const inventory = new Inventory({ store: new PgInventoryStore(tx, principal.tenantId, body.companyId), clock: deps.clock });
      for (const [item, qty] of needed) {
        const available = await inventory.available(body.companyId, body.warehouse, item, body.date);
        if (available < qty) {
          problems.push(`STOCK_SHORT: ${item} needs ${qty.toString()}, ${available.toString()} available`);
        }
      }

      const ledger = new Ledger(new PgLedgerStore(tx, principal.tenantId), body.companyId, currency, deps.clock);
      if (!(await ledger.isPeriodOpen(body.date))) {
        problems.push(`PERIOD_CLOSED: no open fiscal period covers ${body.date}`);
      }

      return {
        currency,
        lines: priced.lines.map((line) => ({
          itemCode: line.itemCode,
          description: line.description,
          qty: line.qty.toString(),
          tracked: line.tracked,
          unitPrice: line.unitPrice.toJSON(),
          discount: line.discount.toJSON(),
          billDiscount: line.billDiscount.toJSON(),
          net: line.net.toJSON(),
          tax: line.tax.toJSON(),
          total: line.total.toJSON(),
        })),
        billDiscount: priced.billDiscount.toJSON(),
        subtotal: priced.subtotal.toJSON(),
        tax: priced.tax.toJSON(),
        total: priced.total.toJSON(),
        tendered: payment.tendered.toJSON(),
        change: payment.change.toJSON(),
        problems,
      };
    });
  });

  /**
   * Decides a sale that was kept for review. POST posts it now, with the payments as reconciled and on an open
   * date. If it still cannot be posted, nothing is written and the response is 409 with the reasons. VOID records
   * that it will never be posted. A sale can be decided once.
   */
  app.post("/v1/pos/sales/:id/review", async (request, reply) => {
    const { id } = SaleParams.parse(request.params);
    const body = ReviewBody.parse(request.body);
    const principal = await deps.authenticate(request);
    requirePermission(principal, "pos.sale.review");
    const company = await companyFor(principal, body.companyId);
    const outcome = await withTenantTransaction(deps.pool, principal.tenantId, async (tx) => {
      const approvedBy =
        body.billDiscountApprovalId === undefined
          ? undefined
          : await approvedDiscountBy(
              tx,
              principal.tenantId,
              body.companyId,
              body.billDiscountApprovalId,
              id,
              await storedDiscountOf(tx, principal.tenantId, body.companyId, id, company.baseCurrency),
            );
      const register = registerFor(tx, principal, body.companyId, company, body.accounts, body.discountApprovalAbove);
      const result = await register.review({
        companyId: body.companyId,
        saleId: id,
        decidedBy: principal.userId,
        decision: body.decision,
        reason: body.reason,
        ...(body.date ? { date: body.date } : {}),
        ...(body.tenders ? { tenders: body.tenders.map((tender) => ({ method: tender.method, amount: Money.fromDecimal(tender.amount, company.baseCurrency) })) } : {}),
        ...(approvedBy ? { billDiscountApprovedBy: approvedBy } : {}),
      });
      if (result.decision) {
        await new AuditLog(new PgAuditStore(tx), deps.clock).record({
          tenantId: principal.tenantId,
          actorId: principal.userId,
          action: "REVIEW",
          entityType: "pos_sale",
          entityId: id,
          after: { decision: result.decision.decision, number: result.decision.number, postedOn: result.decision.postedOn, reason: result.decision.reason },
        });
      }
      return result;
    });
    if (outcome.decision === null) {
      return reply.status(409).send({
        error: { code: "CONFLICT", message: "The sale still cannot be posted", details: { reasons: outcome.reasons } },
        sale: saleJson(outcome.sale),
        reasons: outcome.reasons,
      });
    }
    return reply.status(200).send({ sale: saleJson(outcome.sale), decision: decisionJson(outcome.decision), reasons: [] });
  });

  /** Sales for review or reconciliation. status=NEEDS_REVIEW with pending=true lists only the sales nobody has decided. */
  app.get("/v1/pos/sales", async (request) => {
    const query = SalesQuery.parse(request.query);
    const principal = await deps.authenticate(request);
    requirePermission(principal, "pos.sale.read");
    await companyFor(principal, query.companyId);
    return withTenantTransaction(deps.pool, principal.tenantId, async (tx) => {
      const sales = await new PgPosStore(tx, principal.tenantId).list(query.companyId, query.status);
      return sales.filter((sale) => query.pending !== "true" || sale.resolution === null).map(saleJson);
    });
  });

  /** The bill discount stored on a sale, so an approval can be matched to it. */
  async function storedDiscountOf(tx: Transaction, tenantId: string, companyId: string, saleId: string, currency: string): Promise<Money> {
    const sale = await new PgPosStore(tx, tenantId).find(companyId, saleId);
    if (!sale) {
      throw new DomainError("NOT_FOUND", "Sale not found");
    }
    return Money.fromDecimal(sale.billDiscount.toDecimal(), currency);
  }
}

function rejected(id: string, message: string): SyncResult {
  return { id, status: "REJECTED", number: null, duplicate: false, reasons: [message] };
}

/** One sale line from its wire form. Money is parsed from its decimal string in the company currency. */
function saleLine(line: z.infer<typeof LineBody>, currency: string): SaleLineInput {
  return {
    itemCode: line.itemCode,
    description: line.description,
    qty: BigInt(line.qty),
    unitPrice: Money.fromDecimal(line.unitPrice, currency),
    discount: line.discount === undefined ? undefined : Money.fromDecimal(line.discount, currency),
    taxRateBps: BigInt(line.taxRateBps),
    taxMode: line.taxMode,
    revenueAccount: line.revenueAccount,
    tracked: line.tracked,
  };
}

function toSaleInput(sale: z.infer<typeof SaleBody>, companyId: string, currency: string, approvedBy: string | null): SaleInput {
  return {
    id: sale.id,
    companyId,
    warehouse: sale.warehouse,
    date: sale.date,
    currency,
    lines: sale.lines.map((line) => saleLine(line, currency)),
    tenders: sale.tenders.map((tender) => ({ method: tender.method, amount: Money.fromDecimal(tender.amount, currency) })),
    ...(sale.billDiscount
      ? {
          billDiscount: {
            amount: Money.fromDecimal(sale.billDiscount.amount, currency),
            reason: sale.billDiscount.reason,
            approvedBy,
          },
        }
      : {}),
  };
}

function decisionJson(decision: PosDecision) {
  return {
    decision: decision.decision,
    decidedBy: decision.decidedBy,
    decidedAt: decision.decidedAt,
    reason: decision.reason,
    postedOn: decision.postedOn,
    number: decision.number,
    entryId: decision.entryId,
    cost: decision.cost?.toJSON() ?? null,
    change: decision.change.toJSON(),
    tenders: decision.tenders.map((tender) => ({ method: tender.method, amount: tender.amount.toJSON() })),
  };
}

function saleJson(sale: PosSale) {
  const resolution = sale.resolution;
  return {
    id: sale.id,
    status: sale.status,
    effectiveStatus: resolution ? (resolution.decision === "POSTED" ? "POSTED" : "VOIDED") : sale.status,
    number: resolution?.number ?? sale.number,
    warehouse: sale.warehouse,
    date: sale.date,
    currency: sale.currency,
    billDiscount: sale.billDiscount.toJSON(),
    billDiscountReason: sale.billDiscountReason,
    billDiscountApprovedBy: sale.billDiscountApprovedBy,
    subtotal: sale.subtotal.toJSON(),
    tax: sale.tax.toJSON(),
    total: sale.total.toJSON(),
    change: sale.change.toJSON(),
    cost: sale.cost?.toJSON() ?? null,
    tenders: sale.tenders.map((tender) => ({ method: tender.method, amount: tender.amount.toJSON() })),
    reasons: sale.reasons,
    recordedAt: sale.recordedAt,
    resolution: resolution ? decisionJson(resolution) : null,
  };
}
