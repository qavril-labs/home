import { Money } from "@erp/money";
import type { Invoice, InvoiceRecord, InvoiceStatus, InvoiceStore } from "@erp/sales";
import type { Queryable } from "./pool";

interface InvoiceRow {
  number: string;
  customer: string;
  invoice_date: string;
  currency: string;
  total_minor: string;
  tax_minor: string;
  settled_minor: string;
  status: InvoiceStatus;
  entry_id: string;
  payments: number;
}

/**
 * Postgres invoice store. Pass the transaction the ledger entry is posted in, so the invoice and
 * its entry commit or roll back together. Tenant rows are protected by row-level security, so the
 * transaction must come from withTenantTransaction.
 */
export class PgInvoiceStore implements InvoiceStore {
  constructor(
    private readonly db: Queryable,
    private readonly tenantId: string,
    private readonly companyId: string,
  ) {}

  async get(number: string): Promise<InvoiceRecord | undefined> {
    const { rows } = await this.db.query<InvoiceRow>(
      `SELECT number, customer, invoice_date::text, currency, total_minor, tax_minor, settled_minor,
              status, entry_id, payments
         FROM sales_invoices
        WHERE tenant_id = $1 AND company_id = $2 AND number = $3`,
      [this.tenantId, this.companyId, number],
    );
    const row = rows[0];
    return row ? toRecord(row) : undefined;
  }

  async save(record: InvoiceRecord): Promise<void> {
    const { invoice, payments } = record;
    await this.db.query(
      `INSERT INTO sales_invoices (tenant_id, company_id, number, customer, invoice_date, currency,
                                   total_minor, tax_minor, settled_minor, status, entry_id, payments, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, now())
       ON CONFLICT (tenant_id, company_id, number) DO UPDATE
         SET settled_minor = EXCLUDED.settled_minor,
             status = EXCLUDED.status,
             payments = EXCLUDED.payments,
             updated_at = now()`,
      [
        this.tenantId,
        this.companyId,
        invoice.number,
        invoice.customer,
        invoice.date,
        invoice.currency,
        invoice.total.minor.toString(),
        invoice.tax.minor.toString(),
        invoice.settled.minor.toString(),
        invoice.status,
        invoice.entryId,
        payments,
      ],
    );
  }

  async listOpen(): Promise<InvoiceRecord[]> {
    const { rows } = await this.db.query<InvoiceRow>(
      `SELECT number, customer, invoice_date::text, currency, total_minor, tax_minor, settled_minor,
              status, entry_id, payments
         FROM sales_invoices
        WHERE tenant_id = $1 AND company_id = $2 AND status = 'OPEN'
        ORDER BY number`,
      [this.tenantId, this.companyId],
    );
    return rows.map(toRecord);
  }
}

function toRecord(row: InvoiceRow): InvoiceRecord {
  const invoice: Invoice = {
    number: row.number,
    customer: row.customer,
    date: row.invoice_date,
    currency: row.currency.trim(),
    total: Money.of(BigInt(row.total_minor), row.currency.trim()),
    tax: Money.of(BigInt(row.tax_minor), row.currency.trim()),
    settled: Money.of(BigInt(row.settled_minor), row.currency.trim()),
    status: row.status,
    entryId: row.entry_id,
  };
  return { invoice, payments: row.payments };
}
