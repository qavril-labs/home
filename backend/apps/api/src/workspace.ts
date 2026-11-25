import { balancesFor, computeInsights } from "./insights";
import { idempotencyKeyFrom, runIdempotent } from "./idempotency";
import { auditWrite } from "./audit-write";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { hasPermission, type Principal } from "@erp/identity";
import { Ledger, type AccountType } from "@erp/ledger";
import { Money } from "@erp/money";
import { NumberingService } from "@erp/numbering";
import { DomainError, type Clock } from "@erp/kernel";
import type { Company } from "@erp/tenancy";
import {
  PgCounterStore,
  PgLedgerStore,
  PgTenantRepository,
  listEntitlements,
  withTenantTransaction,
  type Pool,
  type Queryable,
} from "@erp/db";

/** The chart of accounts every new workspace starts with. Owners add or rename accounts later. */
export const STARTER_ACCOUNTS: readonly { code: string; name: string; type: AccountType }[] = [
  { code: "1000", name: "Cash on hand", type: "ASSET" },
  { code: "1100", name: "Bank", type: "ASSET" },
  { code: "1200", name: "Customers owe you", type: "ASSET" },
  { code: "1300", name: "Stock", type: "ASSET" },
  { code: "2000", name: "You owe suppliers", type: "LIABILITY" },
  { code: "2100", name: "Tax payable", type: "LIABILITY" },
  { code: "3000", name: "Owner's equity", type: "EQUITY" },
  { code: "4000", name: "Sales", type: "REVENUE" },
  { code: "4100", name: "Service income", type: "REVENUE" },
  { code: "5000", name: "Cost of goods sold", type: "EXPENSE" },
  { code: "6000", name: "Rent", type: "EXPENSE" },
  { code: "6100", name: "Salaries", type: "EXPENSE" },
  { code: "6200", name: "Utilities", type: "EXPENSE" },
  { code: "6300", name: "Marketing", type: "EXPENSE" },
  { code: "6900", name: "Other expenses", type: "EXPENSE" },
];

/** Products a self-service workspace starts with: the general ledger and the chart of accounts. */
export const STARTER_PRODUCTS = ["FIN-01", "MDM-03"] as const;

const QUICK_ENTRY_SEQUENCE = { key: "quick-entry", prefix: "QE-", padding: 5, reset: "YEARLY" } as const;

/** The fiscal year that contains `date`, given the month the fiscal year starts in. */
export function fiscalStartYear(date: string, startMonth: number): number {
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  return month >= startMonth ? year : year - 1;
}

/**
 * Turns on the starter products, creates the starter accounts that are missing, and opens the
 * fiscal year that contains today. Safe to run again: existing accounts and periods are kept.
 */
export async function setUpStarterBooks(tx: Queryable, tenantId: string, company: Company, clock: Clock): Promise<void> {
  for (const productId of STARTER_PRODUCTS) {
    await tx.query("INSERT INTO tenant_products (tenant_id, product_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [tenantId, productId]);
  }
  const store = new PgLedgerStore(tx, tenantId);
  const ledger = new Ledger(store, company.id, company.baseCurrency, clock);
  const existing = new Set((await store.listAccounts(company.id)).map((account) => account.code));
  for (const account of STARTER_ACCOUNTS) {
    if (!existing.has(account.code)) await ledger.createAccount(account);
  }
  const today = clock.now().toISOString().slice(0, 10);
  const startYear = fiscalStartYear(today, company.fiscalYearStartMonth);
  const periods = await store.listFiscalPeriods(company.id);
  const covered = periods.some((p) => p.startDate <= today && p.endDate >= today);
  if (!covered) await ledger.createFiscalYear(startYear, company.fiscalYearStartMonth);
}

/**
 * The workspace's first company. Filters by tenant explicitly as well as through row-level
 * security, so a connection that bypasses RLS (a superuser) still cannot see another tenant.
 */
async function firstCompany(tx: Queryable, tenantId: string): Promise<Company> {
  const { rows } = await tx.query<{ id: string }>("SELECT id FROM companies WHERE tenant_id = $1 ORDER BY id LIMIT 1", [tenantId]);
  const id = rows[0]?.id;
  const company = id ? await new PgTenantRepository(tx).findCompany(id) : null;
  if (!company) throw new DomainError("NOT_FOUND", "This workspace has no company yet");
  return company;
}

const QuickEntryBody = z.object({
  kind: z.enum(["sale", "expense", "owner_investment", "customer_payment"]),
  amount: z.string().trim().regex(/^\d{1,13}(\.\d{1,3})?$/),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /** For an expense, the expense account. For a sale, the revenue account. */
  account: z.string().trim().max(20).optional(),
  /**
   * Where the money moved: cash on hand (1000) or the bank (1100). A sale can also be on credit
   * (1200, customers owe you) and an expense can be a bill to pay later (2000, you owe suppliers).
   */
  via: z.enum(["1000", "1100", "1200", "2000"]),
  memo: z.string().trim().max(200).optional(),
});

export interface WorkspaceRouteDeps {
  readonly pool: Pool;
  readonly clock: Clock;
  readonly authenticate: (request: FastifyRequest) => Promise<Principal>;
}

/** Routes behind the signed-in app dashboard. Each needs a session and the stated permission. */
export function registerWorkspaceRoutes(app: FastifyInstance, deps: WorkspaceRouteDeps): void {
  async function signedIn(request: FastifyRequest, permission: string): Promise<Principal> {
    const principal = await deps.authenticate(request);
    if (!hasPermission(principal.permissions, permission)) {
      throw new DomainError("FORBIDDEN", `Missing permission ${permission}`);
    }
    return principal;
  }

  app.get("/v1/workspace/overview", async (request) => {
    const principal = await signedIn(request, "fin.report.read");
    return withTenantTransaction(deps.pool, principal.tenantId, async (tx) => {
      const tenant = await new PgTenantRepository(tx).findTenantById(principal.tenantId);
      const company = await firstCompany(tx, principal.tenantId);
      const products = await listEntitlements(tx);
      const store = new PgLedgerStore(tx, principal.tenantId);
      const accounts = await store.listAccounts(company.id);
      const booksReady = products.has("FIN-01") && accounts.length > 0;
      const zero = Money.zero(company.baseCurrency);
      const entries = booksReady ? await store.listEntries(company.id) : [];
      const balances = balancesFor(accounts, entries, company.baseCurrency);
      const rows = accounts.map((account) => ({
        code: account.code,
        name: account.name,
        type: account.type,
        balance: balances.get(account.code) ?? zero,
      }));
      const total = (pick: (r: (typeof rows)[number]) => boolean) => rows.filter(pick).reduce((sum, r) => sum.add(r.balance), zero);
      const cash = total((r) => r.code === "1000" || r.code === "1100");
      const revenue = total((r) => r.type === "REVENUE");
      const expenses = total((r) => r.type === "EXPENSE");
      // Monthly revenue and expenses for the last six months, oldest first.
      const today = deps.clock.now().toISOString().slice(0, 10);
      const months: string[] = [];
      for (let i = 5; i >= 0; i -= 1) {
        const d = new Date(Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1 - i, 1));
        months.push(d.toISOString().slice(0, 7));
      }
      const types = new Map(accounts.map((a) => [a.code, a.type]));
      const trend = months.map((month) => {
        let rev = zero;
        let exp = zero;
        for (const entry of entries) {
          if (entry.date.slice(0, 7) !== month) continue;
          for (const line of entry.lines) {
            const type = types.get(line.account);
            const signed = line.side === "DEBIT" ? line.baseAmount : line.baseAmount.negate();
            if (type === "REVENUE") rev = rev.subtract(signed);
            if (type === "EXPENSE") exp = exp.add(signed);
          }
        }
        return { month, revenue: rev.toDecimal(), expenses: exp.toDecimal() };
      });
      const insights = computeInsights({ entries, accounts, currency: company.baseCurrency, today });
      const recent = [...entries]
        .sort((a, b) => (a.date === b.date ? b.postedAt.localeCompare(a.postedAt) : b.date.localeCompare(a.date)))
        .slice(0, 8)
        .map((entry) => ({
          id: entry.id,
          reference: entry.reference,
          date: entry.date,
          memo: entry.memo,
          reversal: entry.reversalOf !== null,
          amount: entry.lines
            .filter((l) => l.side === "DEBIT")
            .reduce((sum, l) => sum.add(l.baseAmount), zero)
            .toDecimal(),
          accounts: [...new Set(entry.lines.map((l) => l.account))],
        }));
      return {
        principal: { email: principal.email, roles: principal.roles },
        workspace: { slug: tenant?.slug ?? "", name: tenant?.name ?? "" },
        company: { id: company.id, name: company.legalName, currency: company.baseCurrency, country: company.countryCode },
        products: [...products].sort(),
        booksReady,
        asOf: today,
        totals: {
          cash: cash.toDecimal(),
          revenue: revenue.toDecimal(),
          expenses: expenses.toDecimal(),
          profit: revenue.subtract(expenses).toDecimal(),
          receivable: total((r) => r.code === "1200").toDecimal(),
          payable: total((r) => r.code === "2000").toDecimal(),
        },
        trend,
        insights,
        accounts: rows.map((r) => ({ ...r, balance: r.balance.toDecimal() })),
        recent,
      };
    });
  });

  /**
   * The bot signals on their own, for the bots and for the approvals inbox. Reads only; each
   * figure is computed from every posted entry, not from the recent ones shown on the dashboard.
   */
  app.get("/v1/workspace/insights", async (request) => {
    const principal = await signedIn(request, "fin.report.read");
    return withTenantTransaction(deps.pool, principal.tenantId, async (tx) => {
      const company = await firstCompany(tx, principal.tenantId);
      const store = new PgLedgerStore(tx, principal.tenantId);
      const accounts = await store.listAccounts(company.id);
      const entries = await store.listEntries(company.id);
      const today = deps.clock.now().toISOString().slice(0, 10);
      return {
        asOf: today,
        currency: company.baseCurrency,
        insights: computeInsights({ entries, accounts, currency: company.baseCurrency, today }),
      };
    });
  });

  app.post("/v1/workspace/starter-books", async (request, reply) => {
    const principal = await signedIn(request, "fin.accounts.write");
    await withTenantTransaction(deps.pool, principal.tenantId, async (tx) =>
      setUpStarterBooks(tx, principal.tenantId, await firstCompany(tx, principal.tenantId), deps.clock),
    );
    return reply.status(201).send({ status: "ready" });
  });

  app.post("/v1/workspace/quick-entries", async (request, reply) => {
    const principal = await signedIn(request, "fin.journal.post");
    const body = QuickEntryBody.parse(request.body);
    const key = idempotencyKeyFrom(request);
    const postEntry = async (tx: Queryable) => {
      const company = await firstCompany(tx, principal.tenantId);
      const store = new PgLedgerStore(tx, principal.tenantId);
      const accounts = new Map((await store.listAccounts(company.id)).map((a) => [a.code, a]));
      const amount = Money.fromDecimal(body.amount, company.baseCurrency);
      if (amount.isZero()) throw new DomainError("VALIDATION", "Amount must be more than zero");
      let debit: string;
      let credit: string;
      const paid = body.via === "1000" || body.via === "1100";
      if (body.kind === "sale" && body.via === "2000") throw new DomainError("VALIDATION", "A sale is paid in cash, to the bank, or on credit");
      if (body.kind === "expense" && body.via === "1200") throw new DomainError("VALIDATION", "An expense is paid in cash, from the bank, or as a bill");
      if ((body.kind === "owner_investment" || body.kind === "customer_payment") && !paid) {
        throw new DomainError("VALIDATION", "Choose cash on hand or the bank");
      }
      if (body.kind === "sale") {
        credit = body.account ?? "4000";
        if (accounts.get(credit)?.type !== "REVENUE") throw new DomainError("VALIDATION", "Choose an income account for a sale");
        debit = body.via;
      } else if (body.kind === "expense") {
        debit = body.account ?? "6900";
        if (accounts.get(debit)?.type !== "EXPENSE") throw new DomainError("VALIDATION", "Choose an expense account");
        credit = body.via;
      } else if (body.kind === "customer_payment") {
        debit = body.via;
        credit = "1200";
      } else {
        debit = body.via;
        credit = "3000";
      }
      const numbering = new NumberingService(new PgCounterStore(tx), [QUICK_ENTRY_SEQUENCE]);
      const reference = await numbering.next(principal.tenantId, QUICK_ENTRY_SEQUENCE.key, body.date);
      const ledger = new Ledger(store, company.id, company.baseCurrency, deps.clock);
      return ledger.post({
        reference,
        date: body.date,
        currency: company.baseCurrency,
        memo: body.memo || null,
        lines: [
          { account: debit, side: "DEBIT", amount, memo: null },
          { account: credit, side: "CREDIT", amount, memo: null },
        ],
      });
    };
    // A retry with the same Idempotency-Key replays the first response instead of posting again.
    const result = await withTenantTransaction(deps.pool, principal.tenantId, (tx) =>
      runIdempotent(tx, { tenantId: principal.tenantId, scope: "workspace.quick-entry", key, payload: body }, async () => {
        const entry = await postEntry(tx);
        await auditWrite(tx, deps.clock, principal, request, {
          action: "workspace.quick-entry", entityType: "journal_entry", entityId: entry.id,
          after: { reference: entry.reference, kind: body.kind, amount: body.amount, date: body.date, via: body.via },
        });
        return { status: 201, body: { id: entry.id, reference: entry.reference } };
      }),
    );
    return reply.status(result.status).send(result.body);
  });
}
