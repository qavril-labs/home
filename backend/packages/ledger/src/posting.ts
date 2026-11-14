import type { Money } from "@erp/money";

export type Side = "DEBIT" | "CREDIT";

/** One line as the caller wrote it. `amount` is positive, in the entry's currency. */
export interface EntryLineInput {
  readonly account: string;
  readonly side: Side;
  readonly amount: Money;
  readonly memo?: string | null;
}

export interface PostEntryInput {
  /** Caller's document reference. Unique per company, so retries are safe. */
  readonly reference: string;
  /** YYYY-MM-DD business date. Chooses the fiscal period and the exchange rate. */
  readonly date: string;
  /** Currency the lines are written in. */
  readonly currency: string;
  readonly memo?: string | null;
  readonly lines: readonly EntryLineInput[];
}

export interface PostedLine {
  readonly account: string;
  readonly side: Side;
  /** In the entry's currency. */
  readonly amount: Money;
  /** The same amount in the company's base currency, at the rate used when posting. */
  readonly baseAmount: Money;
  readonly memo: string | null;
}

/** Stored, immutable journal entry. Corrections are made by posting a reversal. */
export interface PostedEntry {
  readonly id: string;
  readonly companyId: string;
  readonly reference: string;
  readonly date: string;
  readonly periodId: string;
  readonly currency: string;
  readonly baseCurrency: string;
  readonly memo: string | null;
  readonly reversalOf: string | null;
  readonly lines: readonly PostedLine[];
  readonly postedAt: string;
}

/** Content fingerprint. Equal fingerprints mean a retry; different ones mean a reused reference. */
export function describeEntry(
  date: string,
  currency: string,
  memo: string | null,
  lines: readonly { account: string; side: Side; amount: Money; memo?: string | null }[],
): string {
  return JSON.stringify({
    date,
    currency,
    memo: memo ?? null,
    lines: lines.map((line) => [line.account, line.side, line.amount.toDecimal(), line.memo ?? null]),
  });
}
