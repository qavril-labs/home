// Pure functions behind the workspace figures and the bot signals. No database, no clock: the
// caller passes the entries, the account types and today's date. Bots read these signals and
// propose work from them; this module never changes a book.
import { type AccountType, type PostedEntry } from "@erp/ledger";
import { Money } from "@erp/money";

export interface AccountRow {
  readonly code: string;
  readonly name: string;
  readonly type: AccountType;
}

export interface DuplicateGroup {
  readonly date: string;
  readonly memo: string | null;
  readonly references: readonly string[];
}

export interface Insights {
  readonly entriesThisMonth: number;
  readonly entriesWithoutNote: number;
  readonly expenseCount: number;
  /** Total expense divided by the count, rounded up to the minor unit. Never a float. */
  readonly averageExpense: string;
  readonly largestExpense: {
    readonly amount: string;
    readonly memo: string | null;
    readonly date: string;
    readonly reference: string;
  } | null;
  readonly duplicates: readonly DuplicateGroup[];
  readonly stock: string;
  readonly costOfSales: string;
}

/** Normal balance: assets and expenses grow with debits, the rest grow with credits. */
export function signedBalance(type: AccountType, debit: Money, credit: Money): Money {
  return type === "ASSET" || type === "EXPENSE" ? debit.subtract(credit) : credit.subtract(debit);
}

/** Each account's normal-side balance, from every posted line. Accounts with no lines are zero. */
export function balancesFor(
  accounts: readonly AccountRow[],
  entries: readonly PostedEntry[],
  currency: string,
): Map<string, Money> {
  const zero = Money.zero(currency);
  const sums = new Map<string, { debit: Money; credit: Money }>();
  for (const entry of entries) {
    for (const line of entry.lines) {
      const s = sums.get(line.account) ?? { debit: zero, credit: zero };
      sums.set(
        line.account,
        line.side === "DEBIT"
          ? { ...s, debit: s.debit.add(line.baseAmount) }
          : { ...s, credit: s.credit.add(line.baseAmount) },
      );
    }
  }
  return new Map(
    accounts.map((account) => {
      const s = sums.get(account.code) ?? { debit: zero, credit: zero };
      return [account.code, signedBalance(account.type, s.debit, s.credit)];
    }),
  );
}

/** The workspace's signals as of `today` (YYYY-MM-DD). Reversals are never counted as duplicates. */
export function computeInsights(input: {
  readonly entries: readonly PostedEntry[];
  readonly accounts: readonly AccountRow[];
  readonly currency: string;
  readonly today: string;
}): Insights {
  const zero = Money.zero(input.currency);
  const types = new Map(input.accounts.map((a) => [a.code, a.type]));
  const balances = balancesFor(input.accounts, input.entries, input.currency);
  const month = input.today.slice(0, 7);

  const thisMonth = input.entries.filter((e) => e.date.slice(0, 7) === month);

  const expenseLines = input.entries.flatMap((entry) =>
    entry.lines
      .filter((line) => line.side === "DEBIT" && types.get(line.account) === "EXPENSE")
      .map((line) => ({ entry, amount: line.baseAmount })),
  );
  const largest = expenseLines.reduce<(typeof expenseLines)[number] | null>(
    (best, item) => (best === null || item.amount.compare(best.amount) > 0 ? item : best),
    null,
  );
  const expenseTotal = expenseLines.reduce((sum, item) => sum.add(item.amount), zero);

  const groups = new Map<string, PostedEntry[]>();
  for (const entry of input.entries) {
    if (entry.reversalOf) continue;
    const debitTotal = entry.lines
      .filter((line) => line.side === "DEBIT")
      .reduce((sum, line) => sum.add(line.baseAmount), zero);
    const key = `${entry.date}|${debitTotal.toDecimal()}|${(entry.memo ?? "").trim().toLowerCase()}`;
    groups.set(key, [...(groups.get(key) ?? []), entry]);
  }
  const duplicates: DuplicateGroup[] = [...groups.values()]
    .filter((group) => group.length > 1)
    .map((group) => ({
      date: group[0]!.date,
      memo: group[0]!.memo,
      references: group.map((entry) => entry.reference),
    }));

  return {
    entriesThisMonth: thisMonth.length,
    entriesWithoutNote: thisMonth.filter((entry) => !entry.memo).length,
    expenseCount: expenseLines.length,
    averageExpense: expenseLines.length
      ? expenseTotal.allocate(expenseLines.map(() => 1n))[0]!.toDecimal()
      : "0.00",
    largestExpense: largest
      ? {
          amount: largest.amount.toDecimal(),
          memo: largest.entry.memo,
          date: largest.entry.date,
          reference: largest.entry.reference,
        }
      : null,
    duplicates,
    stock: (balances.get("1300") ?? zero).toDecimal(),
    costOfSales: (balances.get("5000") ?? zero).toDecimal(),
  };
}
