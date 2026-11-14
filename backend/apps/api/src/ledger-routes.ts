import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { hasPermission, type Principal } from "@erp/identity";
import { Ledger } from "@erp/ledger";
import { Money } from "@erp/money";
import { DomainError, type Clock } from "@erp/kernel";
import { assertEntitled, type Company } from "@erp/tenancy";
import {
  PgLedgerStore,
  PgTenantRepository,
  listEntitlements,
  withTenantTransaction,
  type Pool,
} from "@erp/db";

const AccountBody = z.object({
  companyId: z.uuid(),
  code: z.string(),
  name: z.string(),
  type: z.string(),
});

const FiscalYearBody = z.object({
  companyId: z.uuid(),
  startYear: z.number().int(),
});

const RateBody = z.object({
  companyId: z.uuid(),
  base: z.string(),
  quote: z.string(),
  effectiveDate: z.string(),
  rate: z.string(),
});

const EntryBody = z.object({
  companyId: z.uuid(),
  reference: z.string(),
  date: z.string(),
  currency: z.string(),
  memo: z.string().optional(),
  lines: z
    .array(
      z.object({
        account: z.string(),
        side: z.enum(["DEBIT", "CREDIT"]),
        amount: z.string(),
        memo: z.string().optional(),
      }),
    )
    .min(2),
});

const ReverseBody = z.object({
  companyId: z.uuid(),
  reference: z.string(),
  date: z.string(),
});

const TrialBalanceQuery = z.object({
  companyId: z.uuid(),
  asOf: z.string(),
});

const EntryParams = z.object({ id: z.uuid() });

export interface LedgerRouteDeps {
  readonly pool: Pool;
  readonly clock: Clock;
  readonly authenticate: (request: FastifyRequest) => Promise<Principal>;
}

/**
 * General ledger routes. Each one needs three things, in this order: a signed-in user, the
 * permission for the action, and the FIN-01 product in the tenant's entitlements. The company
 * must belong to the caller's tenant.
 */
export function registerLedgerRoutes(app: FastifyInstance, deps: LedgerRouteDeps): void {
  async function withLedger<T>(
    request: FastifyRequest,
    permission: string,
    companyId: string,
    work: (ledger: Ledger, company: Company) => Promise<T>,
  ): Promise<T> {
    const principal = await deps.authenticate(request);
    if (!hasPermission(principal.permissions, permission)) {
      throw new DomainError("FORBIDDEN", `Missing permission ${permission}`);
    }
    return withTenantTransaction(deps.pool, principal.tenantId, async (tx) => {
      assertEntitled(await listEntitlements(tx), "FIN-01");
      const company = await new PgTenantRepository(tx).findCompany(companyId);
      if (!company) {
        throw new DomainError("NOT_FOUND", "Company not found");
      }
      const ledger = new Ledger(
        new PgLedgerStore(tx, principal.tenantId),
        companyId,
        company.baseCurrency,
        deps.clock,
      );
      return work(ledger, company);
    });
  }

  app.post("/v1/ledger/accounts", async (request, reply) => {
    const body = AccountBody.parse(request.body);
    const account = await withLedger(request, "fin.accounts.write", body.companyId, (ledger) =>
      ledger.createAccount({ code: body.code, name: body.name, type: body.type }),
    );
    return reply.status(201).send(account);
  });

  app.post("/v1/ledger/fiscal-years", async (request, reply) => {
    const body = FiscalYearBody.parse(request.body);
    const periods = await withLedger(request, "fin.periods.write", body.companyId, (ledger, company) =>
      ledger.createFiscalYear(body.startYear, company.fiscalYearStartMonth),
    );
    return reply.status(201).send({ periods });
  });

  app.post("/v1/ledger/fx-rates", async (request, reply) => {
    const body = RateBody.parse(request.body);
    await withLedger(request, "fin.rates.write", body.companyId, (ledger) =>
      ledger.setRate({
        base: body.base,
        quote: body.quote,
        effectiveDate: body.effectiveDate,
        rate: body.rate,
      }),
    );
    return reply.status(201).send({ status: "saved" });
  });

  app.post("/v1/ledger/journal-entries", async (request, reply) => {
    const body = EntryBody.parse(request.body);
    const entry = await withLedger(request, "fin.journal.post", body.companyId, (ledger) =>
      ledger.post({
        reference: body.reference,
        date: body.date,
        currency: body.currency,
        memo: body.memo ?? null,
        lines: body.lines.map((line) => ({
          account: line.account,
          side: line.side,
          amount: Money.fromDecimal(line.amount, body.currency),
          memo: line.memo ?? null,
        })),
      }),
    );
    return reply.status(201).send(entry);
  });

  app.post("/v1/ledger/journal-entries/:id/reverse", async (request, reply) => {
    const { id } = EntryParams.parse(request.params);
    const body = ReverseBody.parse(request.body);
    const entry = await withLedger(request, "fin.journal.post", body.companyId, (ledger) =>
      ledger.reverse(id, { reference: body.reference, date: body.date }),
    );
    return reply.status(201).send(entry);
  });

  app.get("/v1/ledger/trial-balance", async (request) => {
    const query = TrialBalanceQuery.parse(request.query);
    return withLedger(request, "fin.report.read", query.companyId, (ledger) => ledger.trialBalance(query.asOf));
  });
}
