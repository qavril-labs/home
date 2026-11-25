// Ledger consumer for sales invoices (SAL-04 to FIN-01). Called by the worker for outbox events, and by
// tests directly. Every function is idempotent: a redelivered event changes nothing.
import type { DomainEvent } from "@erp/events";
import { DomainError, type Clock } from "@erp/kernel";
import { Ledger } from "@erp/ledger";
import { buildInvoiceEntry, buildInvoicePaymentEntry } from "@erp/sales";
import { PgLedgerStore } from "./ledger-store";
import type { Pool, Queryable } from "./pool";
import { withTenantTransaction } from "./transactions";

export const INVOICE_ISSUED = "sales.invoice.issued";
export const INVOICE_PAID = "sales.invoice.paid";

export interface InvoiceIssuedPayload {
  readonly invoiceId: string;
}

export interface InvoicePaidPayload {
  readonly invoiceId: string;
  /** Decimal string in the invoice currency. */
  readonly amount: string;
  /** YYYY-MM-DD the money was received. */
  readonly date: string;
  /** 1 for the first payment on the invoice. */
  readonly sequence: number;
  /** Bank or cash account; omitted means the default bank account. */
  readonly depositAccount?: string | null;
}

export type PostingOutcome =
  | { readonly result: "POSTED"; readonly entryId: string }
  | { readonly result: "ALREADY_POSTED" }
  | { readonly result: "SKIPPED"; readonly reason: string }
  | { readonly result: "FAILED"; readonly reason: string };

interface InvoiceRow {
  id: string;
  company_id: string;
  invoice_number: string;
  issue_date: string;
  currency: string;
  status: string;
  tax_total: string;
  total: string;
  posting_status: string;
  posting_version: number;
  ledger_entry_id: string | null;
  party_name: string;
  receivable_account: string | null;
}

async function loadInvoice(tx: Queryable, invoiceId: string): Promise<InvoiceRow | null> {
  const { rows } = await tx.query<InvoiceRow>(
    `SELECT i.id, i.company_id, i.invoice_number, i.issue_date::text, i.currency, i.status, i.tax_total::text, i.total::text,
            i.posting_status, i.posting_version, i.ledger_entry_id, p.name AS party_name, p.receivable_account
       FROM invoices i JOIN parties p ON p.id = i.party_id
      WHERE i.id = $1
      FOR UPDATE OF i`,
    [invoiceId],
  );
  return rows[0] ?? null;
}

async function ledgerFor(tx: Queryable, tenantId: string, companyId: string, clock: Clock): Promise<{ ledger: Ledger; baseCurrency: string }> {
  const { rows } = await tx.query<{ base_currency: string }>("SELECT base_currency FROM companies WHERE id = $1", [companyId]);
  const baseCurrency = rows[0]?.base_currency.trim();
  if (!baseCurrency) throw new DomainError("NOT_FOUND", "Company not found");
  return { ledger: new Ledger(new PgLedgerStore(tx, tenantId), companyId, baseCurrency, clock), baseCurrency };
}

async function markFailed(tx: Queryable, invoiceId: string, reason: string): Promise<PostingOutcome> {
  await tx.query("UPDATE invoices SET posting_status = 'FAILED', posting_error = $2 WHERE id = $1", [invoiceId, reason.slice(0, 500)]);
  return { result: "FAILED", reason };
}

/**
 * Posts an issued invoice: receivable debited, income and tax credited. A problem with the document
 * (accounts missing, lines that do not add up, a foreign currency) is recorded on the invoice as FAILED
 * with the reason, so the user sees it. Only unexpected errors are thrown, so the event is retried.
 */
export async function postIssuedInvoice(tx: Queryable, tenantId: string, clock: Clock, invoiceId: string): Promise<PostingOutcome> {
  const invoice = await loadInvoice(tx, invoiceId);
  if (!invoice) return { result: "SKIPPED", reason: "Invoice not found" };
  if (invoice.status === "draft" || invoice.status === "void") return { result: "SKIPPED", reason: `Invoice is ${invoice.status}` };
  if (invoice.posting_status === "POSTED") return { result: "ALREADY_POSTED" };
  if (invoice.posting_status === "NOT_POSTED") return { result: "SKIPPED", reason: "Invoice was not queued for posting" };

  try {
    const { ledger, baseCurrency } = await ledgerFor(tx, tenantId, invoice.company_id, clock);
    if (invoice.currency !== baseCurrency) {
      throw new DomainError("VALIDATION", `Invoices in ${invoice.currency} are not posted yet; the books are in ${baseCurrency}`);
    }
    const { rows: lines } = await tx.query<{ description: string; line_total: string; revenue_account: string | null }>(
      `SELECT l.description, l.line_total::text, it.revenue_account
         FROM invoice_lines l LEFT JOIN items it ON it.id = l.item_id
        WHERE l.invoice_id = $1 ORDER BY l.id`,
      [invoice.id],
    );
    const entry = buildInvoiceEntry({
      number: invoice.invoice_number,
      customerName: invoice.party_name,
      date: invoice.issue_date,
      currency: invoice.currency,
      receivableAccount: invoice.receivable_account,
      lines: lines.map((l) => ({ description: l.description, lineTotal: l.line_total, revenueAccount: l.revenue_account })),
      taxTotal: invoice.tax_total,
      total: invoice.total,
      version: invoice.posting_version,
    });
    const posted = await ledger.post(entry);
    await tx.query(
      "UPDATE invoices SET posting_status = 'POSTED', ledger_entry_id = $2, posting_error = NULL, posted_at = $3 WHERE id = $1",
      [invoice.id, posted.id, clock.now().toISOString()],
    );
    return { result: "POSTED", entryId: posted.id };
  } catch (error) {
    if (error instanceof DomainError) return markFailed(tx, invoice.id, error.message);
    throw error;
  }
}

/**
 * Posts money received against a posted invoice: bank or cash debited, receivable credited. If the
 * invoice is still waiting to be posted the error is thrown, so the event is retried after it.
 */
export async function postInvoicePayment(tx: Queryable, tenantId: string, clock: Clock, payload: InvoicePaidPayload): Promise<PostingOutcome> {
  const invoice = await loadInvoice(tx, payload.invoiceId);
  if (!invoice) return { result: "SKIPPED", reason: "Invoice not found" };
  if (invoice.posting_status === "NOT_POSTED") return { result: "SKIPPED", reason: "Invoice is not in the books" };
  if (invoice.posting_status === "PENDING") throw new Error(`Invoice ${invoice.invoice_number} is not posted yet; retry the payment`);
  if (invoice.posting_status === "FAILED") return { result: "SKIPPED", reason: "Invoice posting failed; payment not posted" };

  try {
    const { ledger } = await ledgerFor(tx, tenantId, invoice.company_id, clock);
    const entry = buildInvoicePaymentEntry({
      number: invoice.invoice_number,
      customerName: invoice.party_name,
      date: payload.date,
      currency: invoice.currency,
      receivableAccount: invoice.receivable_account,
      depositAccount: payload.depositAccount ?? null,
      amount: payload.amount,
      sequence: payload.sequence,
    });
    const posted = await ledger.post(entry);
    return { result: "POSTED", entryId: posted.id };
  } catch (error) {
    if (error instanceof DomainError) {
      await tx.query("UPDATE invoices SET posting_error = $2 WHERE id = $1", [invoice.id, `Payment not posted: ${error.message}`.slice(0, 500)]);
      return { result: "FAILED", reason: error.message };
    }
    throw error;
  }
}

/** Entry point for the worker: one outbox event, handled in the event's own tenant. */
export async function handleInvoiceEvent(pool: Pool, clock: Clock, event: Pick<DomainEvent, "type" | "tenantId" | "payload">): Promise<PostingOutcome | null> {
  if (event.type === INVOICE_ISSUED) {
    const { invoiceId } = event.payload as InvoiceIssuedPayload;
    return withTenantTransaction(pool, event.tenantId, (tx) => postIssuedInvoice(tx, event.tenantId, clock, invoiceId));
  }
  if (event.type === INVOICE_PAID) {
    const payload = event.payload as InvoicePaidPayload;
    return withTenantTransaction(pool, event.tenantId, (tx) => postInvoicePayment(tx, event.tenantId, clock, payload));
  }
  return null;
}
