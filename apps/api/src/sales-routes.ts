import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { hasPermission, type Principal } from "@erp/identity";
import { Ledger } from "@erp/ledger";
import { Money } from "@erp/money";
import { DomainError, type Clock } from "@erp/kernel";
import { NumberingService } from "@erp/numbering";
import { SALES_INVOICE_SEQUENCE, SalesInvoicing, type InvoiceLine } from "@erp/sales";
import { assertEntitled, type Company } from "@erp/tenancy";
import {
  PgCounterStore,
  PgInvoiceStore,
  PgLedgerStore,
  PgTenantRepository,
  listEntitlements,
  withTenantTransaction,
  type Pool,
} from "@erp/db";

const LineBody = z.object({
  description: z.string(),
  revenueAccount: z.string(),
  amount: z.string(),
  taxAccount: z.string().optional(),
  tax: z.string().optional(),
});

const IssueBody = z.object({
  companyId: z.uuid(),
  customer: z.string(),
  date: z.string(),
  currency: z.string(),
  receivableAccount: z.string(),
  lines: z.array(LineBody).min(1),
});

const PaymentBody = z.object({
  companyId: z.uuid(),
  date: z.string(),
  amount: z.string(),
  bankAccount: z.string(),
  receivableAccount: z.string(),
});

const VoidBody = z.object({
  companyId: z.uuid(),
  date: z.string(),
  receivableAccount: z.string(),
});

const CompanyQuery = z.object({ companyId: z.uuid() });
const NumberParams = z.object({ number: z.string().min(1).max(60) });

export interface SalesRouteDeps {
  readonly pool: Pool;
  readonly clock: Clock;
  readonly authenticate: (request: FastifyRequest) => Promise<Principal>;
}

type Transaction = Parameters<Parameters<typeof withTenantTransaction>[2]>[0];

interface SalesContext {
  readonly tx: Transaction;
  readonly tenantId: string;
  readonly company: Company;
  readonly clock: Clock;
}

/**
 * Sales invoice routes (SAL-04). Each one needs a signed-in user, the permission for the action,
 * and both FIN-01 and SAL-04 enabled for the tenant. The company must belong to the caller's tenant.
 * Invoices, their ledger entries and their numbers are written in one transaction.
 */
export function registerSalesRoutes(app: FastifyInstance, deps: SalesRouteDeps): void {
  async function withSales<T>(
    request: FastifyRequest,
    permission: string,
    companyId: string,
    work: (context: SalesContext) => Promise<T>,
  ): Promise<T> {
    const principal = await deps.authenticate(request);
    if (!hasPermission(principal.permissions, permission)) {
      throw new DomainError("FORBIDDEN", `Missing permission ${permission}`);
    }
    return withTenantTransaction(deps.pool, principal.tenantId, async (tx) => {
      const entitlements = await listEntitlements(tx);
      assertEntitled(entitlements, "FIN-01");
      assertEntitled(entitlements, "SAL-04");
      const company = await new PgTenantRepository(tx).findCompany(companyId);
      if (!company) {
        throw new DomainError("NOT_FOUND", "Company not found");
      }
      return work({ tx, tenantId: principal.tenantId, company, clock: deps.clock });
    });
  }

  /** Builds the invoicing service for one request, with the caller's receivable account. */
  function invoicingFor(context: SalesContext, companyId: string, receivableAccount: string): SalesInvoicing {
    const ledger = new Ledger(
      new PgLedgerStore(context.tx, context.tenantId),
      companyId,
      context.company.baseCurrency,
      context.clock,
    );
    const numbering = new NumberingService(new PgCounterStore(context.tx), [
      { key: SALES_INVOICE_SEQUENCE, prefix: "INV-", padding: 6, reset: "YEARLY" },
    ]);
    return new SalesInvoicing(
      ledger,
      numbering,
      context.tenantId,
      receivableAccount,
      new PgInvoiceStore(context.tx, context.tenantId, companyId),
    );
  }

  app.post("/v1/sales/invoices", async (request, reply) => {
    const body = IssueBody.parse(request.body);
    const invoice = await withSales(request, "sal.invoices.write", body.companyId, (context) =>
      invoicingFor(context, body.companyId, body.receivableAccount).issue({
        customer: body.customer,
        date: body.date,
        currency: body.currency,
        lines: body.lines.map(toInvoiceLine(body.currency)),
      }),
    );
    return reply.status(201).send(invoice);
  });

  app.post("/v1/sales/invoices/:number/payments", async (request, reply) => {
    const { number } = NumberParams.parse(request.params);
    const body = PaymentBody.parse(request.body);
    const invoice = await withSales(request, "sal.invoices.pay", body.companyId, async (context) => {
      const sales = invoicingFor(context, body.companyId, body.receivableAccount);
      const current = await sales.get(number);
      if (!current) {
        throw new DomainError("NOT_FOUND", `Invoice ${number} does not exist`);
      }
      return sales.recordPayment({
        invoice: number,
        date: body.date,
        amount: Money.fromDecimal(body.amount, current.currency),
        bankAccount: body.bankAccount,
      });
    });
    return reply.status(201).send(invoice);
  });

  app.post("/v1/sales/invoices/:number/void", async (request, reply) => {
    const { number } = NumberParams.parse(request.params);
    const body = VoidBody.parse(request.body);
    const invoice = await withSales(request, "sal.invoices.void", body.companyId, (context) =>
      invoicingFor(context, body.companyId, body.receivableAccount).void(number, body.date),
    );
    return reply.status(200).send(invoice);
  });

  app.get("/v1/sales/invoices/:number", async (request) => {
    const { number } = NumberParams.parse(request.params);
    const query = CompanyQuery.parse(request.query);
    return withSales(request, "sal.invoices.read", query.companyId, async (context) => {
      const invoice = await invoicingFor(context, query.companyId, "").get(number);
      if (!invoice) {
        throw new DomainError("NOT_FOUND", `Invoice ${number} does not exist`);
      }
      return invoice;
    });
  });

  app.get("/v1/sales/invoices", async (request) => {
    const query = CompanyQuery.parse(request.query);
    return withSales(request, "sal.invoices.read", query.companyId, async (context) =>
      invoicingFor(context, query.companyId, "").outstanding(),
    );
  });
}

function toInvoiceLine(currency: string): (line: z.infer<typeof LineBody>) => InvoiceLine {
  return (line) => ({
    description: line.description,
    revenueAccount: line.revenueAccount,
    amount: Money.fromDecimal(line.amount, currency),
    ...(line.taxAccount ? { taxAccount: line.taxAccount } : {}),
    ...(line.tax ? { tax: Money.fromDecimal(line.tax, currency) } : {}),
  });
}
