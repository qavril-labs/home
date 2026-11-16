import { DomainError } from "@erp/kernel";
import type { Ledger } from "@erp/ledger";
import { Money } from "@erp/money";
import type { NumberingService } from "@erp/numbering";

/** Sequence key the caller registers with NumberingService for sales invoices. */
export const SALES_INVOICE_SEQUENCE = "SALES_INVOICE";

const MAX_LINES = 100;

export interface InvoiceLine {
  readonly description: string;
  /** Income account credited with the net amount of the line. */
  readonly revenueAccount: string;
  /** Net amount of the line, positive, in the invoice currency. */
  readonly amount: Money;
  /** Tax account credited with the tax on the line. Required when `tax` is above zero. */
  readonly taxAccount?: string;
  /** Tax on the line, zero or positive. Worked out by the caller, for example from the tax codes. */
  readonly tax?: Money;
}

export interface IssueInvoiceInput {
  readonly customer: string;
  /** YYYY-MM-DD. Chooses the fiscal period, the number's reset period and the exchange rate. */
  readonly date: string;
  readonly currency: string;
  readonly lines: readonly InvoiceLine[];
}

export interface RecordPaymentInput {
  readonly invoice: string;
  readonly date: string;
  /** Positive amount in the invoice currency. */
  readonly amount: Money;
  /** Bank or cash account the money arrived in. */
  readonly bankAccount: string;
}

export type InvoiceStatus = "OPEN" | "PAID" | "VOID";

export interface Invoice {
  readonly number: string;
  readonly customer: string;
  readonly date: string;
  readonly currency: string;
  /** Net plus tax. */
  readonly total: Money;
  readonly tax: Money;
  /** Money received so far, in the invoice currency. */
  readonly settled: Money;
  readonly status: InvoiceStatus;
  readonly entryId: string;
}

/** An invoice together with the number of payments recorded against it. */
export interface InvoiceRecord {
  readonly invoice: Invoice;
  readonly payments: number;
}

/**
 * Storage for invoices. The Postgres implementation runs inside the same transaction as the
 * ledger entry and the document number, so a failure leaves neither a posted entry nor a gap.
 */
export interface InvoiceStore {
  get(number: string): Promise<InvoiceRecord | undefined>;
  save(record: InvoiceRecord): Promise<void>;
  listOpen(): Promise<InvoiceRecord[]>;
}

/** In-memory store for tests and single-process use. Not transactional. */
export class MemoryInvoiceStore implements InvoiceStore {
  private readonly records = new Map<string, InvoiceRecord>();

  async get(number: string): Promise<InvoiceRecord | undefined> {
    return this.records.get(number);
  }

  async save(record: InvoiceRecord): Promise<void> {
    this.records.set(record.invoice.number, record);
  }

  async listOpen(): Promise<InvoiceRecord[]> {
    return [...this.records.values()].filter((record) => record.invoice.status === "OPEN");
  }
}

/**
 * Sales invoices posted to the general ledger. Issuing debits receivables and credits income
 * and tax. A payment debits the bank and credits receivables. Voiding posts a reversal, and is
 * only allowed before any money has been received.
 */
export class SalesInvoicing {
  constructor(
    private readonly ledger: Ledger,
    private readonly numbering: NumberingService,
    private readonly tenantId: string,
    private readonly receivableAccount: string,
    private readonly store: InvoiceStore = new MemoryInvoiceStore(),
  ) {}

  async issue(input: IssueInvoiceInput): Promise<Invoice> {
    validateLines(input.lines, input.currency);
    const zero = Money.zero(input.currency);
    const net = input.lines.reduce((sum, line) => sum.add(line.amount), zero);
    const tax = input.lines.reduce((sum, line) => sum.add(line.tax ?? zero), zero);
    const total = net.add(tax);
    if (total.minor <= 0n) {
      throw new DomainError("VALIDATION", "An invoice must have a total above zero");
    }

    const number = await this.numbering.next(this.tenantId, SALES_INVOICE_SEQUENCE, input.date);
    const posted = await this.ledger.post({
      reference: number,
      date: input.date,
      currency: input.currency,
      memo: `Sales invoice ${number} to ${input.customer}`,
      lines: [
        { account: this.receivableAccount, side: "DEBIT", amount: total },
        ...input.lines.flatMap((line) => {
          const credits = [{ account: line.revenueAccount, side: "CREDIT" as const, amount: line.amount, memo: line.description }];
          if (line.tax && line.tax.minor > 0n) {
            credits.push({ account: requireTaxAccount(line), side: "CREDIT" as const, amount: line.tax, memo: `Tax on ${line.description}` });
          }
          return credits;
        }),
      ],
    });

    const invoice: Invoice = {
      number,
      customer: input.customer,
      date: input.date,
      currency: input.currency,
      total,
      tax,
      settled: zero,
      status: "OPEN",
      entryId: posted.id,
    };
    await this.store.save({ invoice, payments: 0 });
    return invoice;
  }

  async recordPayment(input: RecordPaymentInput): Promise<Invoice> {
    const record = await this.require(input.invoice);
    const { invoice } = record;
    if (invoice.status === "VOID") {
      throw new DomainError("CONFLICT", `Invoice ${invoice.number} is void`);
    }
    if (input.amount.currency !== invoice.currency) {
      throw new DomainError("VALIDATION", `Payment must be in ${invoice.currency}`);
    }
    if (input.amount.minor <= 0n) {
      throw new DomainError("VALIDATION", "A payment must be above zero");
    }
    const outstanding = invoice.total.minor - invoice.settled.minor;
    if (input.amount.minor > outstanding) {
      throw new DomainError("VALIDATION", "Payment is more than the amount outstanding", {
        outstanding: Money.of(outstanding, invoice.currency).toDecimal(),
      });
    }

    const reference = `${invoice.number}/PAY/${record.payments + 1}`;
    await this.ledger.post({
      reference,
      date: input.date,
      currency: invoice.currency,
      memo: `Payment for ${invoice.number}`,
      lines: [
        { account: input.bankAccount, side: "DEBIT", amount: input.amount },
        { account: this.receivableAccount, side: "CREDIT", amount: input.amount },
      ],
    });

    const settled = invoice.settled.add(input.amount);
    const status: InvoiceStatus = settled.minor === invoice.total.minor ? "PAID" : "OPEN";
    const updated: Invoice = { ...invoice, settled, status };
    await this.store.save({ invoice: updated, payments: record.payments + 1 });
    return updated;
  }

  /** Cancels an invoice that has no payments, by posting the reversal of its entry. */
  async void(number: string, date: string): Promise<Invoice> {
    const record = await this.require(number);
    const { invoice } = record;
    if (invoice.status === "VOID") {
      throw new DomainError("CONFLICT", `Invoice ${number} is already void`);
    }
    if (invoice.settled.minor > 0n) {
      throw new DomainError("CONFLICT", "An invoice with payments cannot be voided. Record a credit note instead.");
    }
    await this.ledger.reverse(invoice.entryId, { reference: `${number}/VOID`, date });
    const updated: Invoice = { ...invoice, status: "VOID" };
    await this.store.save({ invoice: updated, payments: record.payments });
    return updated;
  }

  async get(number: string): Promise<Invoice | undefined> {
    return (await this.store.get(number))?.invoice;
  }

  /** Invoices with money still owed, oldest number first. */
  async outstanding(): Promise<Invoice[]> {
    return (await this.store.listOpen()).map((record) => record.invoice).sort((a, b) => a.number.localeCompare(b.number));
  }

  private async require(number: string): Promise<InvoiceRecord> {
    const record = await this.store.get(number);
    if (!record) {
      throw new DomainError("NOT_FOUND", `Invoice ${number} does not exist`);
    }
    return record;
  }
}

function requireTaxAccount(line: InvoiceLine): string {
  if (!line.taxAccount) {
    throw new DomainError("VALIDATION", `Line "${line.description}" has tax but no tax account`);
  }
  return line.taxAccount;
}

function validateLines(lines: readonly InvoiceLine[], currency: string): void {
  if (lines.length === 0) {
    throw new DomainError("VALIDATION", "An invoice needs at least one line");
  }
  if (lines.length > MAX_LINES) {
    throw new DomainError("VALIDATION", `An invoice can have at most ${MAX_LINES} lines`);
  }
  for (const line of lines) {
    if (line.description.trim().length === 0) {
      throw new DomainError("VALIDATION", "Every line needs a description");
    }
    if (line.amount.currency !== currency) {
      throw new DomainError("VALIDATION", `Line "${line.description}" must be in ${currency}`);
    }
    if (line.amount.minor <= 0n) {
      throw new DomainError("VALIDATION", `Line "${line.description}" must be above zero`);
    }
    if (line.tax && (line.tax.currency !== currency || line.tax.minor < 0n)) {
      throw new DomainError("VALIDATION", `Tax on "${line.description}" must be zero or more, in ${currency}`);
    }
  }
}
