import type { Money } from "@erp/money";

/**
 * A stock count (INV-09). A count is taken for one warehouse on one date. Each batch is counted blind: the
 * counter records what they see, and the expected quantity stays hidden until the count is submitted. When
 * the count is applied, the difference is posted as an adjustment, and the difference in value goes to the
 * count-variance account. A count is applied only after a second person approves it (see the approval queue).
 */
export const COUNT_STATUSES = ["OPEN", "SUBMITTED", "APPLIED", "CANCELLED"] as const;
export type CountStatus = (typeof COUNT_STATUSES)[number];

export interface CountLine {
  readonly batchId: string;
  readonly batchNo: string;
  readonly item: string;
  readonly expiresOn: string | null;
  readonly unitCost: Money;
  /** Units on hand when the count started. Frozen, so later sales do not change what the counter is checked against. */
  readonly expected: bigint;
  /** Units the counter recorded. Null until they count the batch. */
  readonly counted: bigint | null;
}

export interface StockCount {
  readonly id: string;
  readonly companyId: string;
  readonly warehouse: string;
  /** The date the count is taken, YYYY-MM-DD. Adjustments are posted on this date. */
  readonly date: string;
  readonly status: CountStatus;
  readonly lines: readonly CountLine[];
}

/** The change one line needs when the count is applied. Zero when the count agrees with the books. */
export function varianceOf(line: CountLine): bigint {
  if (line.counted === null) {
    throw new Error("A line without a counted quantity has no variance yet");
  }
  return line.counted - line.expected;
}
