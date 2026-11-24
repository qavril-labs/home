// Builds the journal entries for stored sales invoices (SAL-04 to FIN-01). Pure: no database, no clock.
// The caller reads the invoice, picks the accounts, and posts the result through Ledger.post.
import { DomainError } from "@erp/kernel";
import type { PostEntryInput } from "@erp/ledger";
import { Money } from "@erp/money";

/** Starter chart fallbacks used when an item or party carries no account of its own. */
export const DEFAULT_ACCOUNTS = {
  receivable: "1200",
  revenue: "4000",
  taxPayable: "2100",
  bank: "1100",
} as const;

export interface InvoicePostingLine {
  readonly description: string;
  /** Net amount of the line as a decimal string, zero or positive. */
  readonly lineTotal: string;
  /** Income account of the item on the line; null falls back to the default. */
  readonly revenueAccount: string | null;
}

export interface InvoicePostingInput {
  readonly number: string;
  readonly customerName: string;
  /** YYYY-MM-DD. */
  readonly date: string;
  readonly currency: string;
  readonly receivableAccount: string | null;
  readonly lines: readonly InvoicePostingLine[];
  readonly taxTotal: string;
  readonly total: string;
  /** 0 for the first posting, 1 after the first edit, and so on. Makes the reference unique per version. */
  readonly version: number;
}

/** Ledger reference of version `version` of a document: `INV-1`, then `INV-1/R1`, `INV-1/R2`. */
export function postingReference(number: string, version: number): string {
  return version === 0 ? number : `${number}/R${version}`;
}

function sum(values: readonly Money[], currency: string): Money {
  return values.reduce((acc, value) => acc.add(value), Money.zero(currency));
}

/**
 * Receivable debited with the total, income credited per account with the net, tax payable credited
 * with the tax. Refuses an invoice whose lines and tax do not add up to its total, so a wrong document
 * is reported instead of posting an entry that does not match it.
 */
export function buildInvoiceEntry(input: InvoicePostingInput): PostEntryInput {
  if (input.lines.length === 0) throw new DomainError("VALIDATION", "An invoice needs at least one line to post");
  const net = sum(input.lines.map((line) => Money.fromDecimal(line.lineTotal, input.currency)), input.currency);
  const tax = Money.fromDecimal(input.taxTotal, input.currency);
  const total = Money.fromDecimal(input.total, input.currency);
  if (input.lines.some((line) => Money.fromDecimal(line.lineTotal, input.currency).minor < 0n) || tax.minor < 0n) {
    throw new DomainError("VALIDATION", "Line and tax amounts cannot be negative");
  }
  if (total.minor <= 0n) throw new DomainError("VALIDATION", "An invoice must have a total above zero");
  if (!net.add(tax).equals(total)) {
    throw new DomainError("VALIDATION", "Lines plus tax do not add up to the invoice total", {
      lines: net.toDecimal(),
      tax: tax.toDecimal(),
      total: total.toDecimal(),
    });
  }

  const credits = new Map<string, Money>();
  for (const line of input.lines) {
    const account = line.revenueAccount ?? DEFAULT_ACCOUNTS.revenue;
    const amount = Money.fromDecimal(line.lineTotal, input.currency);
    credits.set(account, (credits.get(account) ?? Money.zero(input.currency)).add(amount));
  }

  return {
    reference: postingReference(input.number, input.version),
    date: input.date,
    currency: input.currency,
    memo: `Sales invoice ${input.number} to ${input.customerName}`,
    lines: [
      { account: input.receivableAccount ?? DEFAULT_ACCOUNTS.receivable, side: "DEBIT", amount: total },
      ...[...credits.entries()]
        .filter(([, amount]) => amount.minor > 0n)
        .sort(([a], [b]) => (a < b ? -1 : 1))
        .map(([account, amount]) => ({ account, side: "CREDIT" as const, amount })),
      ...(tax.minor > 0n ? [{ account: DEFAULT_ACCOUNTS.taxPayable, side: "CREDIT" as const, amount: tax }] : []),
    ],
  };
}

export interface InvoicePaymentPostingInput {
  readonly number: string;
  readonly customerName: string;
  readonly date: string;
  readonly currency: string;
  readonly receivableAccount: string | null;
  /** Bank or cash account the money arrived in; null means the default bank account. */
  readonly depositAccount: string | null;
  /** Positive decimal string. */
  readonly amount: string;
  /** 1 for the first payment on the invoice. */
  readonly sequence: number;
}

/** Money received: bank or cash debited, receivable credited. */
export function buildInvoicePaymentEntry(input: InvoicePaymentPostingInput): PostEntryInput {
  const amount = Money.fromDecimal(input.amount, input.currency);
  if (amount.minor <= 0n) throw new DomainError("VALIDATION", "A payment must be above zero");
  return {
    reference: `${input.number}/PAY/${input.sequence}`,
    date: input.date,
    currency: input.currency,
    memo: `Payment for invoice ${input.number} from ${input.customerName}`,
    lines: [
      { account: input.depositAccount ?? DEFAULT_ACCOUNTS.bank, side: "DEBIT", amount },
      { account: input.receivableAccount ?? DEFAULT_ACCOUNTS.receivable, side: "CREDIT", amount },
    ],
  };
}
