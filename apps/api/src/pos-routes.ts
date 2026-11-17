import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { AuditLog } from "@erp/audit";
import { hasPermission, type Principal } from "@erp/identity";
import { Inventory, type InventoryAccounts } from "@erp/inventory";
import { Ledger } from "@erp/ledger";
import { Money } from "@erp/money";
import { NumberingService } from "@erp/numbering";
import {
  POS_SALE_SEQUENCE,
  PosRegister,
  TENDER_METHODS,
  type PosSale,
  type SaleInput,
  type SaleStatus,
} from "@erp/pos";
import { DomainError, type Clock } from "@erp/kernel";
import { assertEntitled, type Company } from "@erp/tenancy";
import {
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

const SaleBody = z.object({
  id: z.uuid(),
  warehouse: z.string().min(1).max(60),
  date: DATE,
  currency: z.string().regex(/^[A-Z]{3}$/, "Currency as a three-letter code"),
  lines: z.array(LineBody).min(1).max(200),
  tenders: z.array(TenderBody).min(1).max(10),
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
});

const SyncBody = z.object({
  companyId: z.uuid(),
  accounts: AccountsBody,
  /** Each sale is checked on its own, so one malformed sale is reported without failing the rest. */
  sales: z.array(z.unknown()).min(1).max(200),
});

const SalesQuery = z.object({
  companyId: z.uuid(),
  status: z.enum(["POSTED", "NEEDS_REVIEW"]).optional(),
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

/**
 * Point-of-sale routes (POS-01). Devices that were offline sync their sales in a batch. Each sale is posted
 * in full or kept for review, and a sale that was already synced is returned as it was stored, so a retried
 * batch never posts twice. Each sale is its own transaction, so one refused sale does not hold up the others.
 * Needs a signed-in user, the permission for the action, and the POS-01, INV-01, INV-03 and FIN-01 products.
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
        const accounts = body.accounts;
        const inventoryAccounts: InventoryAccounts = {
          inventory: accounts.inventory,
          clearing: accounts.clearing,
          cogs: accounts.cogs,
          writeOff: accounts.writeOff,
        };
        const ledger = new Ledger(new PgLedgerStore(tx, principal.tenantId), body.companyId, company.baseCurrency, deps.clock);
        const register = new PosRegister({
          tenantId: principal.tenantId,
          store: new PgPosStore(tx, principal.tenantId),
          inventory: new Inventory({
            store: new PgInventoryStore(tx, principal.tenantId, body.companyId),
            posting: { ledger, accounts: inventoryAccounts },
            clock: deps.clock,
          }),
          ledger,
          numbering: new NumberingService(new PgCounterStore(tx), [
            { key: POS_SALE_SEQUENCE, prefix: "POS-", padding: 6, reset: "YEARLY" },
          ]),
          accounts: {
            tenders: { CASH: accounts.cash, CARD: accounts.card, MOBILE: accounts.mobile },
            taxPayable: accounts.taxPayable,
          },
          clock: deps.clock,
        });
        const { sale: stored, duplicate } = await register.record(toSaleInput(sale, body.companyId));
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

  /** Sales for review or reconciliation. Pass status=NEEDS_REVIEW to see only the sales waiting for a decision. */
  app.get("/v1/pos/sales", async (request) => {
    const query = SalesQuery.parse(request.query);
    const principal = await deps.authenticate(request);
    requirePermission(principal, "pos.sale.read");
    await companyFor(principal, query.companyId);
    return withTenantTransaction(deps.pool, principal.tenantId, async (tx) => {
      const sales = await new PgPosStore(tx, principal.tenantId).list(query.companyId, query.status);
      return sales.map(saleJson);
    });
  });
}

function rejected(id: string, message: string): SyncResult {
  return { id, status: "REJECTED", number: null, duplicate: false, reasons: [message] };
}

function toSaleInput(sale: z.infer<typeof SaleBody>, companyId: string): SaleInput {
  const currency = sale.currency;
  return {
    id: sale.id,
    companyId,
    warehouse: sale.warehouse,
    date: sale.date,
    currency,
    lines: sale.lines.map((line) => ({
      itemCode: line.itemCode,
      description: line.description,
      qty: BigInt(line.qty),
      unitPrice: Money.fromDecimal(line.unitPrice, currency),
      discount: line.discount === undefined ? undefined : Money.fromDecimal(line.discount, currency),
      taxRateBps: BigInt(line.taxRateBps),
      taxMode: line.taxMode,
      revenueAccount: line.revenueAccount,
      tracked: line.tracked,
    })),
    tenders: sale.tenders.map((tender) => ({ method: tender.method, amount: Money.fromDecimal(tender.amount, currency) })),
  };
}

function saleJson(sale: PosSale) {
  return {
    id: sale.id,
    status: sale.status,
    number: sale.number,
    warehouse: sale.warehouse,
    date: sale.date,
    currency: sale.currency,
    subtotal: sale.subtotal.toJSON(),
    tax: sale.tax.toJSON(),
    total: sale.total.toJSON(),
    change: sale.change.toJSON(),
    cost: sale.cost?.toJSON() ?? null,
    tenders: sale.tenders.map((tender) => ({ method: tender.method, amount: tender.amount.toJSON() })),
    reasons: sale.reasons,
    recordedAt: sale.recordedAt,
  };
}
