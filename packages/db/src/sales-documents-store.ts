import { Money } from "@erp/money";
import type { CreditNote, CreditNoteStore, InvoiceLine, Quote, QuoteStatus, QuoteStore } from "@erp/sales";
import type { Queryable } from "./pool";

interface CreditNoteRow {
  number: string;
  invoice: string;
  note_date: string;
  currency: string;
  total_minor: string;
  tax_minor: string;
  entry_id: string;
}

interface QuoteRow {
  number: string;
  customer_id: string;
  customer: string;
  quote_date: string;
  currency: string;
  lines: SerialisedLine[];
  total_minor: string;
  tax_minor: string;
  status: QuoteStatus;
  invoice: string | null;
}

/** A line as stored in JSON. Amounts are decimal strings, so no money is kept as a float. */
interface SerialisedLine {
  description: string;
  revenueAccount: string;
  amount: string;
  taxAccount?: string;
  tax?: string;
}

/** Postgres credit note store. Pass the transaction the ledger entry is posted in. */
export class PgCreditNoteStore implements CreditNoteStore {
  constructor(private readonly db: Queryable, private readonly tenantId: string, private readonly companyId: string) {}

  async listForInvoice(invoice: string): Promise<CreditNote[]> {
    const { rows } = await this.db.query<CreditNoteRow & { number: string }>(
      `SELECT number, invoice, note_date::text, currency, total_minor, tax_minor, entry_id
         FROM sales_credit_notes WHERE tenant_id = $1 AND company_id = $2 AND invoice = $3 ORDER BY number`,
      [this.tenantId, this.companyId, invoice],
    );
    return rows.map((row) => {
      const currency = row.currency.trim();
      return {
        number: row.number,
        invoice: row.invoice,
        date: row.note_date,
        currency,
        total: Money.of(BigInt(row.total_minor), currency),
        tax: Money.of(BigInt(row.tax_minor), currency),
        entryId: row.entry_id,
      };
    });
  }

  async save(note: CreditNote): Promise<void> {
    await this.db.query(
      `INSERT INTO sales_credit_notes (tenant_id, company_id, number, invoice, note_date, currency, total_minor, tax_minor, entry_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        this.tenantId,
        this.companyId,
        note.number,
        note.invoice,
        note.date,
        note.currency,
        note.total.minor.toString(),
        note.tax.minor.toString(),
        note.entryId,
      ],
    );
  }

  async get(number: string): Promise<CreditNote | undefined> {
    const { rows } = await this.db.query<CreditNoteRow>(
      `SELECT number, invoice, note_date::text, currency, total_minor, tax_minor, entry_id
         FROM sales_credit_notes WHERE tenant_id = $1 AND company_id = $2 AND number = $3`,
      [this.tenantId, this.companyId, number],
    );
    const row = rows[0];
    if (!row) return undefined;
    const currency = row.currency.trim();
    return {
      number: row.number,
      invoice: row.invoice,
      date: row.note_date,
      currency,
      total: Money.of(BigInt(row.total_minor), currency),
      tax: Money.of(BigInt(row.tax_minor), currency),
      entryId: row.entry_id,
    };
  }
}

/** Postgres quote store. A quote posts nothing to the ledger, so it has no transaction rule beyond RLS. */
export class PgQuoteStore implements QuoteStore {
  constructor(private readonly db: Queryable, private readonly tenantId: string, private readonly companyId: string) {}

  async get(number: string): Promise<Quote | undefined> {
    const { rows } = await this.db.query<QuoteRow>(
      `SELECT number, customer_id, customer, quote_date::text, currency, lines, total_minor, tax_minor, status, invoice
         FROM sales_quotes WHERE tenant_id = $1 AND company_id = $2 AND number = $3`,
      [this.tenantId, this.companyId, number],
    );
    const row = rows[0];
    return row ? toQuote(row) : undefined;
  }

  async save(quote: Quote): Promise<void> {
    const lines: SerialisedLine[] = quote.lines.map((line) => ({
      description: line.description,
      revenueAccount: line.revenueAccount,
      amount: line.amount.toDecimal(),
      ...(line.taxAccount ? { taxAccount: line.taxAccount } : {}),
      ...(line.tax ? { tax: line.tax.toDecimal() } : {}),
    }));
    await this.db.query(
      `INSERT INTO sales_quotes (tenant_id, company_id, number, customer_id, customer, quote_date, currency,
                                 lines, total_minor, tax_minor, status, invoice)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       ON CONFLICT (tenant_id, company_id, number) DO UPDATE
         SET status = EXCLUDED.status, invoice = EXCLUDED.invoice`,
      [
        this.tenantId,
        this.companyId,
        quote.number,
        quote.customerId,
        quote.customer,
        quote.date,
        quote.currency,
        JSON.stringify(lines),
        quote.total.minor.toString(),
        quote.tax.minor.toString(),
        quote.status,
        quote.invoice ?? null,
      ],
    );
  }
}

function toQuote(row: QuoteRow): Quote {
  const currency = row.currency.trim();
  const lines: InvoiceLine[] = row.lines.map((line) => ({
    description: line.description,
    revenueAccount: line.revenueAccount,
    amount: Money.fromDecimal(line.amount, currency),
    ...(line.taxAccount ? { taxAccount: line.taxAccount } : {}),
    ...(line.tax ? { tax: Money.fromDecimal(line.tax, currency) } : {}),
  }));
  return {
    number: row.number,
    customerId: row.customer_id,
    customer: row.customer,
    date: row.quote_date,
    currency,
    lines,
    total: Money.of(BigInt(row.total_minor), currency),
    tax: Money.of(BigInt(row.tax_minor), currency),
    status: row.status,
    ...(row.invoice ? { invoice: row.invoice } : {}),
  };
}
