import { DomainError } from "@erp/kernel";
import type { Ledger, PostedEntry } from "@erp/ledger";
import { Money } from "@erp/money";
import type { NumberingService } from "@erp/numbering";

/** Sequence key the caller registers with NumberingService for sales invoices. */
export const SALES_INVOICE_SEQUENCE = "SALES_INVOICE";
/** Sequence key for credit notes. */
export const CREDIT_NOTE_SEQUENCE = "CREDIT_NOTE";

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
  /** Customer party ID from the party master. The caller checks the party is an active customer. */
  readonly customerId: string;
  /** Customer name, copied onto the invoice so it still reads correctly if the party is renamed. */
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

/** One ledger entry behind an invoice, and the document reference it was posted under. */
export interface TraceStep {
  readonly kind: "ISSUE" | "PAYMENT" | "CREDIT_NOTE" | "VOID";
  readonly reference: string;
  /** Undefined only if the entry is missing from the ledger, which the trace reports rather than hides. */
  readonly entry: PostedEntry | undefined;
}

export interface InvoiceTrace {
  readonly invoice: Invoice;
  readonly creditNotes: readonly CreditNote[];
  readonly steps: readonly TraceStep[];
}

export interface CreditNoteInput {
  /** Invoice the credit applies to. */
  readonly invoice: string;
  readonly date: string;
  /** Lines being credited, at the same accounts the invoice used. Amounts are positive. */
  readonly lines: readonly InvoiceLine[];
}

export interface CreditNote {
  readonly number: string;
  readonly invoice: string;
  readonly date: string;
  readonly currency: string;
  /** Net plus tax credited. */
  readonly total: Money;
  readonly tax: Money;
  readonly entryId: string;
}

/** Storage for credit notes. Runs in the same transaction as the ledger entry, as invoices do. */
export interface CreditNoteStore {
  save(note: CreditNote): Promise<void>;
  get(number: string): Promise<CreditNote | undefined>;
  listForInvoice(invoice: string): Promise<CreditNote[]>;
}

export class MemoryCreditNoteStore implements CreditNoteStore {
  private readonly notes = new Map<string, CreditNote>();

  async save(note: CreditNote): Promise<void> {
    this.notes.set(note.number, note);
  }

  async get(number: string): Promise<CreditNote | undefined> {
    return this.notes.get(number);
  }

  async listForInvoice(invoice: string): Promise<CreditNote[]> {
    return [...this.notes.values()].filter((note) => note.invoice === invoice);
  }
}

export interface Invoice {
  readonly number: string;
  readonly customerId: string;
  readonly customer: string;
  readonly date: string;
  readonly currency: string;
  /** Net plus tax. */
  readonly total: Money;
  readonly tax: Money;
  /** Money received so far, in the invoice currency. */
  readonly settled: Money;
  /** Credit notes issued against this invoice, in the invoice currency. */
  readonly credited: Money;
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
    private readonly creditNotes: CreditNoteStore = new MemoryCreditNoteStore(),
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
      customerId: input.customerId,
      customer: input.customer,
      date: input.date,
      currency: input.currency,
      total,
      tax,
      settled: zero,
      credited: zero,
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
    const outstanding = invoice.total.minor - invoice.settled.minor - invoice.credited.minor;
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
    const status: InvoiceStatus = settled.minor + invoice.credited.minor === invoice.total.minor ? "PAID" : "OPEN";
    const updated: Invoice = { ...invoice, settled, status };
    await this.store.save({ invoice: updated, payments: record.payments + 1 });
    return updated;
  }

  /**
   * Credits part or all of an invoice. Posts the lines back to the income and tax accounts and
   * debits the receivable. The credit cannot be more than the amount still owed.
   */
  async creditNote(input: CreditNoteInput): Promise<CreditNote> {
    const record = await this.require(input.invoice);
    const { invoice } = record;
    if (invoice.status === "VOID") {
      throw new DomainError("CONFLICT", `Invoice ${invoice.number} is void`);
    }
    validateLines(input.lines, invoice.currency);
    const zero = Money.zero(invoice.currency);
    const tax = input.lines.reduce((sum, line) => sum.add(line.tax ?? zero), zero);
    const total = input.lines.reduce((sum, line) => sum.add(line.amount), zero).add(tax);
    if (total.minor <= 0n) {
      throw new DomainError("VALIDATION", "A credit note must be above zero");
    }
    const owed = SalesInvoicing.outstandingOf(invoice);
    if (total.minor > owed.minor) {
      throw new DomainError("VALIDATION", "Credit is more than the amount outstanding", { outstanding: owed.toDecimal() });
    }

    const number = await this.numbering.next(this.tenantId, CREDIT_NOTE_SEQUENCE, input.date);
    const posted = await this.ledger.post({
      reference: number,
      date: input.date,
      currency: invoice.currency,
      memo: `Credit note ${number} against ${invoice.number}`,
      lines: [
        ...input.lines.flatMap((line) => {
          const debits = [{ account: line.revenueAccount, side: "DEBIT" as const, amount: line.amount, memo: line.description }];
          if (line.tax && line.tax.minor > 0n) {
            debits.push({ account: requireTaxAccount(line), side: "DEBIT" as const, amount: line.tax, memo: `Tax on ${line.description}` });
          }
          return debits;
        }),
        { account: this.receivableAccount, side: "CREDIT", amount: total },
      ],
    });

    const note: CreditNote = { number, invoice: invoice.number, date: input.date, currency: invoice.currency, total, tax, entryId: posted.id };
    await this.creditNotes.save(note);
    const credited = invoice.credited.add(total);
    const status: InvoiceStatus = invoice.settled.minor + credited.minor === invoice.total.minor ? "PAID" : "OPEN";
    await this.store.save({ invoice: { ...invoice, credited, status }, payments: record.payments });
    return note;
  }

  async getCreditNote(number: string): Promise<CreditNote | undefined> {
    return this.creditNotes.get(number);
  }

  /**
   * Every ledger entry behind an invoice, in the order they happened: the issue, each payment, each
   * credit note, and the void if there was one. A figure on the invoice can be traced to these entries.
   */
  async trace(number: string): Promise<InvoiceTrace> {
    const record = await this.require(number);
    const steps: TraceStep[] = [];
    steps.push({ kind: "ISSUE", reference: number, entry: await this.ledger.entry(record.invoice.entryId) });
    for (let index = 1; index <= record.payments; index += 1) {
      const reference = `${number}/PAY/${index}`;
      steps.push({ kind: "PAYMENT", reference, entry: await this.ledger.entryByReference(reference) });
    }
    const notes = await this.creditNotes.listForInvoice(number);
    for (const note of notes) {
      steps.push({ kind: "CREDIT_NOTE", reference: note.number, entry: await this.ledger.entry(note.entryId) });
    }
    if (record.invoice.status === "VOID") {
      steps.push({ kind: "VOID", reference: `${number}/VOID`, entry: await this.ledger.entryByReference(`${number}/VOID`) });
    }
    return { invoice: record.invoice, creditNotes: notes, steps };
  }

  /** Cancels an invoice that has no payments, by posting the reversal of its entry. */
  async void(number: string, date: string): Promise<Invoice> {
    const record = await this.require(number);
    const { invoice } = record;
    if (invoice.status === "VOID") {
      throw new DomainError("CONFLICT", `Invoice ${number} is already void`);
    }
    if (invoice.settled.minor > 0n || invoice.credited.minor > 0n) {
      throw new DomainError("CONFLICT", "An invoice with payments or credit notes cannot be voided. Record a credit note instead.");
    }
    await this.ledger.reverse(invoice.entryId, { reference: `${number}/VOID`, date });
    const updated: Invoice = { ...invoice, status: "VOID" };
    await this.store.save({ invoice: updated, payments: record.payments });
    return updated;
  }

  /** Amount still owed on an invoice, in its currency. */
  static outstandingOf(invoice: Invoice): Money {
    return Money.of(invoice.total.minor - invoice.settled.minor - invoice.credited.minor, invoice.currency);
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
