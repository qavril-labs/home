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

interface StoredInvoice {
  invoice: Invoice;
  payments: number;
}

/**
 * Sales invoices posted to the general ledger. Issuing debits receivables and credits income
 * and tax. A payment debits the bank and credits receivables. Voiding posts a reversal, and is
 * only allowed before any money has been received.
 *
 * Invoices are kept in memory here. The production version stores them in the same transaction
 * as the ledger entry and the document number, so a failure leaves no gap in the numbering.
 */
export class SalesInvoicing {
  private readonly invoices = new Map<string, StoredInvoice>();

  constructor(
    private readonly ledger: Ledger,
    private readonly numbering: NumberingService,
    private readonly tenantId: string,
    private readonly receivableAccount: string,
  ) {}

  async issue(input: IssueInvoiceInput): Promise<Invoice> {
    validateLines(input.lines, input.currency);
    const tax = input.lines.reduce((sum, line) => sum.add(line.tax ?? zeroOf(line.amount)), zeroOf(input.lines[0]!.amount));
    const net = input.lines.reduce((sum, line) => sum.add(line.amount), zeroOf(input.lines[0]!.amount));
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
      settled: zeroOf(total),
      status: "OPEN",
      entryId: posted.id,
    };
    this.invoices.set(number, { invoice, payments: 0 });
    return invoice;
  }

  async recordPayment(input: RecordPaymentInput): Promise<Invoice> {
    const stored = this.require(input.invoice);
    const { invoice } = stored;
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

    const reference = `${invoice.number}/PAY/${stored.payments + 1}`;
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
    stored.invoice = { ...invoice, settled, status };
    stored.payments += 1;
    return stored.invoice;
  }

  /** Cancels an invoice that has no payments, by posting the reversal of its entry. */
  async void(number: string, date: string): Promise<Invoice> {
    const stored = this.require(number);
    const { invoice } = stored;
    if (invoice.status === "VOID") {
      throw new DomainError("CONFLICT", `Invoice ${number} is already void`);
    }
    if (invoice.settled.minor > 0n) {
      throw new DomainError("CONFLICT", "An invoice with payments cannot be voided. Record a credit note instead.");
    }
    await this.ledger.reverse(invoice.entryId, { reference: `${number}/VOID`, date });
    stored.invoice = { ...invoice, status: "VOID" };
    return stored.invoice;
  }

  get(number: string): Invoice | undefined {
    return this.invoices.get(number)?.invoice;
  }

  /** Invoices with money still owed, oldest number first. */
  outstanding(): Invoice[] {
    return [...this.invoices.values()]
      .map((stored) => stored.invoice)
      .filter((invoice) => invoice.status === "OPEN")
      .sort((a, b) => a.number.localeCompare(b.number));
  }

  private require(number: string): StoredInvoice {
    const stored = this.invoices.get(number);
    if (!stored) {
      throw new DomainError("NOT_FOUND", `Invoice ${number} does not exist`);
    }
    return stored;
  }
}

function zeroOf(amount: Money): Money {
  return Money.zero(amount.currency);
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
