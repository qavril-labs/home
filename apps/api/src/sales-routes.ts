import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { hasPermission, type Principal } from "@erp/identity";
import { Ledger } from "@erp/ledger";
import { Money } from "@erp/money";
import { DomainError, type Clock } from "@erp/kernel";
import { NumberingService } from "@erp/numbering";
import {
  CREDIT_NOTE_SEQUENCE,
  SALES_INVOICE_SEQUENCE,
  SALES_QUOTE_SEQUENCE,
  SalesInvoicing,
  SalesQuotes,
  type InvoiceLine,
} from "@erp/sales";
import { assertEntitled, type Company } from "@erp/tenancy";
import {
  PgCounterStore,
  PgCreditNoteStore,
  PgInvoiceStore,
  PgLedgerStore,
  PgPartyStore,
  PgQuoteStore,
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
  customerId: z.uuid(),
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

const QuoteBody = z.object({
  companyId: z.uuid(),
  customerId: z.uuid(),
  date: z.string(),
  currency: z.string(),
  lines: z.array(LineBody).min(1),
});

const AcceptBody = z.object({
  companyId: z.uuid(),
  date: z.string(),
  receivableAccount: z.string(),
});

const CreditNoteBody = z.object({
  companyId: z.uuid(),
  date: z.string(),
  receivableAccount: z.string(),
  currency: z.string(),
  lines: z.array(LineBody).min(1),
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

  /** Every sales document number comes from the same counters, inside the request transaction. */
  function numberingFor(context: SalesContext): NumberingService {
    return new NumberingService(new PgCounterStore(context.tx), [
      { key: SALES_INVOICE_SEQUENCE, prefix: "INV-", padding: 6, reset: "YEARLY" },
      { key: CREDIT_NOTE_SEQUENCE, prefix: "CN-", padding: 6, reset: "YEARLY" },
      { key: SALES_QUOTE_SEQUENCE, prefix: "QUO-", padding: 6, reset: "YEARLY" },
    ]);
  }

  /** Builds the invoicing service for one request, with the caller's receivable account. */
  function invoicingFor(context: SalesContext, companyId: string, receivableAccount: string): SalesInvoicing {
    const ledger = new Ledger(
      new PgLedgerStore(context.tx, context.tenantId),
      companyId,
      context.company.baseCurrency,
      context.clock,
    );
    return new SalesInvoicing(
      ledger,
      numberingFor(context),
      context.tenantId,
      receivableAccount,
      new PgInvoiceStore(context.tx, context.tenantId, companyId),
      new PgCreditNoteStore(context.tx, context.tenantId, companyId),
    );
  }

  /** Quotes are built on the same invoicing service, so accepting one reuses its numbering and ledger. */
  function quotesFor(context: SalesContext, companyId: string, receivableAccount: string): SalesQuotes {
    return new SalesQuotes(
      invoicingFor(context, companyId, receivableAccount),
      numberingFor(context),
      context.tenantId,
      new PgQuoteStore(context.tx, context.tenantId, companyId),
    );
  }

  /** Loads a customer and refuses it unless it is active and may be invoiced. */
  async function requireActiveCustomer(context: SalesContext, companyId: string, customerId: string) {
    const party = await new PgPartyStore(context.tx, context.tenantId).get(companyId, customerId);
    if (!party || !party.active || (party.kind !== "CUSTOMER" && party.kind !== "BOTH")) {
      throw new DomainError("VALIDATION", "Customer is not an active customer of this company");
    }
    return party;
  }

  app.post("/v1/sales/invoices", async (request, reply) => {
    const body = IssueBody.parse(request.body);
    const invoice = await withSales(request, "sal.invoices.write", body.companyId, async (context) => {
      const party = await requireActiveCustomer(context, body.companyId, body.customerId);
      return invoicingFor(context, body.companyId, body.receivableAccount).issue({
        customerId: party.id,
        customer: party.name,
        date: body.date,
        currency: body.currency,
        lines: body.lines.map(toInvoiceLine(body.currency)),
      });
    });
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

  app.post("/v1/sales/invoices/:number/credit-notes", async (request, reply) => {
    const { number } = NumberParams.parse(request.params);
    const body = CreditNoteBody.parse(request.body);
    const note = await withSales(request, "sal.invoices.credit", body.companyId, (context) =>
      invoicingFor(context, body.companyId, body.receivableAccount).creditNote({
        invoice: number,
        date: body.date,
        lines: body.lines.map(toInvoiceLine(body.currency)),
      }),
    );
    return reply.status(201).send(note);
  });

  app.get("/v1/sales/credit-notes/:number", async (request) => {
    const { number } = NumberParams.parse(request.params);
    const query = CompanyQuery.parse(request.query);
    return withSales(request, "sal.invoices.read", query.companyId, async (context) => {
      const note = await invoicingFor(context, query.companyId, "").getCreditNote(number);
      if (!note) {
        throw new DomainError("NOT_FOUND", `Credit note ${number} does not exist`);
      }
      return note;
    });
  });

  app.post("/v1/sales/quotes", async (request, reply) => {
    const body = QuoteBody.parse(request.body);
    const quote = await withSales(request, "sal.quotes.write", body.companyId, async (context) => {
      const party = await requireActiveCustomer(context, body.companyId, body.customerId);
      return quotesFor(context, body.companyId, "").create({
        customerId: party.id,
        customer: party.name,
        date: body.date,
        currency: body.currency,
        lines: body.lines.map(toInvoiceLine(body.currency)),
      });
    });
    return reply.status(201).send(quote);
  });

  app.get("/v1/sales/quotes/:number", async (request) => {
    const { number } = NumberParams.parse(request.params);
    const query = CompanyQuery.parse(request.query);
    return withSales(request, "sal.quotes.read", query.companyId, async (context) => {
      const quote = await quotesFor(context, query.companyId, "").get(number);
      if (!quote) {
        throw new DomainError("NOT_FOUND", `Quote ${number} does not exist`);
      }
      return quote;
    });
  });

  app.post("/v1/sales/quotes/:number/accept", async (request, reply) => {
    const { number } = NumberParams.parse(request.params);
    const body = AcceptBody.parse(request.body);
    const invoice = await withSales(request, "sal.quotes.write", body.companyId, async (context) => {
      const quote = await quotesFor(context, body.companyId, body.receivableAccount).get(number);
      if (!quote) {
        throw new DomainError("NOT_FOUND", `Quote ${number} does not exist`);
      }
      // The customer may have been deactivated since the quote was made.
      await requireActiveCustomer(context, body.companyId, quote.customerId);
      return quotesFor(context, body.companyId, body.receivableAccount).accept(number, {
        date: body.date,
        receivableAccount: body.receivableAccount,
      });
    });
    return reply.status(201).send(invoice);
  });

  app.post("/v1/sales/quotes/:number/cancel", async (request) => {
    const { number } = NumberParams.parse(request.params);
    const body = CompanyQuery.parse(request.body);
    return withSales(request, "sal.quotes.write", body.companyId, (context) =>
      quotesFor(context, body.companyId, "").cancel(number),
    );
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
