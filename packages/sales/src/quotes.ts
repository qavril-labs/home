import { DomainError } from "@erp/kernel";
import { Money } from "@erp/money";
import type { NumberingService } from "@erp/numbering";
import type { Invoice, InvoiceLine, SalesInvoicing } from "./invoicing";

/** Sequence key for quotes. */
export const SALES_QUOTE_SEQUENCE = "SALES_QUOTE";

export type QuoteStatus = "OPEN" | "ACCEPTED" | "CANCELLED";

export interface QuoteInput {
  readonly customerId: string;
  readonly customer: string;
  readonly date: string;
  readonly currency: string;
  readonly lines: readonly InvoiceLine[];
}

export interface Quote {
  readonly number: string;
  readonly customerId: string;
  readonly customer: string;
  readonly date: string;
  readonly currency: string;
  readonly lines: readonly InvoiceLine[];
  readonly total: Money;
  readonly tax: Money;
  readonly status: QuoteStatus;
  /** Set once the quote is accepted and turned into an invoice. */
  readonly invoice?: string;
}

/** Storage for quotes. A quote posts nothing to the ledger, so it is a plain record. */
export interface QuoteStore {
  get(number: string): Promise<Quote | undefined>;
  save(quote: Quote): Promise<void>;
}

export class MemoryQuoteStore implements QuoteStore {
  private readonly quotes = new Map<string, Quote>();

  async get(number: string): Promise<Quote | undefined> {
    return this.quotes.get(number);
  }

  async save(quote: Quote): Promise<void> {
    this.quotes.set(quote.number, quote);
  }
}

/**
 * Quotes (SAL-04). A quote is an offer with a number, its lines and a total. Accepting it issues
 * an invoice with the same lines in the same transaction, so the quote and the invoice always agree.
 */
export class SalesQuotes {
  constructor(
    private readonly sales: SalesInvoicing,
    private readonly numbering: NumberingService,
    private readonly tenantId: string,
    private readonly store: QuoteStore = new MemoryQuoteStore(),
  ) {}

  async create(input: QuoteInput): Promise<Quote> {
    if (input.lines.length === 0) {
      throw new DomainError("VALIDATION", "A quote needs at least one line");
    }
    const zero = Money.zero(input.currency);
    const tax = input.lines.reduce((sum, line) => sum.add(line.tax ?? zero), zero);
    const total = input.lines.reduce((sum, line) => sum.add(line.amount), zero).add(tax);
    if (total.minor <= 0n) {
      throw new DomainError("VALIDATION", "A quote must have a total above zero");
    }
    const number = await this.numbering.next(this.tenantId, SALES_QUOTE_SEQUENCE, input.date);
    const quote: Quote = { ...input, number, total, tax, status: "OPEN" };
    await this.store.save(quote);
    return quote;
  }

  /** Turns an open quote into an invoice. The quote becomes ACCEPTED and points at the invoice. */
  async accept(number: string, input: { date: string; receivableAccount: string }): Promise<Invoice> {
    const quote = await this.require(number);
    if (quote.status !== "OPEN") {
      throw new DomainError("CONFLICT", `Quote ${number} is ${quote.status.toLowerCase()}`);
    }
    const invoice = await this.sales.issue({
      customerId: quote.customerId,
      customer: quote.customer,
      date: input.date,
      currency: quote.currency,
      lines: quote.lines,
    });
    await this.store.save({ ...quote, status: "ACCEPTED", invoice: invoice.number });
    return invoice;
  }

  async cancel(number: string): Promise<Quote> {
    const quote = await this.require(number);
    if (quote.status !== "OPEN") {
      throw new DomainError("CONFLICT", `Quote ${number} is ${quote.status.toLowerCase()}`);
    }
    const cancelled: Quote = { ...quote, status: "CANCELLED" };
    await this.store.save(cancelled);
    return cancelled;
  }

  async get(number: string): Promise<Quote | undefined> {
    return this.store.get(number);
  }

  private async require(number: string): Promise<Quote> {
    const quote = await this.store.get(number);
    if (!quote) {
      throw new DomainError("NOT_FOUND", `Quote ${number} does not exist`);
    }
    return quote;
  }
}
