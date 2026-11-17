import { Money } from "@erp/money";

/**
 * Tenders for one sale. A sale can be paid in several parts (SPLIT-001: the parts add up to the total).
 * Only cash can be handed back as change, so an overpayment in card or mobile money is a problem to review.
 */

export const TENDER_METHODS = ["CASH", "CARD", "MOBILE"] as const;
export type TenderMethod = (typeof TENDER_METHODS)[number];

export interface Tender {
  readonly method: TenderMethod;
  readonly amount: Money;
}

export interface TenderCheck {
  /** Everything the customer handed over. */
  readonly tendered: Money;
  /** Change owed back to the customer. Zero when the payment is exact or short. */
  readonly change: Money;
  /** Why the payment cannot be accepted as it stands. Empty when it is sound. */
  readonly problems: readonly string[];
}

export const PAYMENT_PROBLEMS = {
  missing: "PAYMENT_MISSING",
  notPositive: "TENDER_NOT_POSITIVE",
  short: "PAYMENT_SHORT",
  changeNotCash: "CHANGE_NOT_FROM_CASH",
} as const;

export function checkTenders(total: Money, tenders: readonly Tender[]): TenderCheck {
  const zero = Money.zero(total.currency);
  if (tenders.length === 0) {
    return { tendered: zero, change: zero, problems: [PAYMENT_PROBLEMS.missing] };
  }
  const problems: string[] = [];
  if (tenders.some((tender) => tender.amount.minor <= 0n)) {
    problems.push(PAYMENT_PROBLEMS.notPositive);
  }
  const tendered = tenders.reduce((sum, tender) => sum.add(tender.amount), zero);
  const comparison = tendered.compare(total);
  if (comparison < 0) {
    problems.push(PAYMENT_PROBLEMS.short);
  }
  const change = comparison > 0 ? tendered.subtract(total) : zero;
  if (change.minor > 0n) {
    const cash = tenders.filter((tender) => tender.method === "CASH").reduce((sum, tender) => sum.add(tender.amount), zero);
    if (cash.compare(change) < 0) {
      problems.push(PAYMENT_PROBLEMS.changeNotCash);
    }
  }
  return { tendered, change: problems.length === 0 ? change : zero, problems };
}
