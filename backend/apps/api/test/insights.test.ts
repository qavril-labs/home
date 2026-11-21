import { describe, expect, it } from "vitest";
import type { PostedEntry } from "@erp/ledger";
import { Money } from "@erp/money";
import { balancesFor, computeInsights, type AccountRow } from "../src/insights";

const accounts: AccountRow[] = [
  { code: "1100", name: "Bank", type: "ASSET" },
  { code: "1300", name: "Stock", type: "ASSET" },
  { code: "4000", name: "Sales", type: "REVENUE" },
  { code: "5000", name: "Cost of goods sold", type: "EXPENSE" },
  { code: "6000", name: "Rent", type: "EXPENSE" },
  { code: "6900", name: "Other expenses", type: "EXPENSE" },
];

let counter = 0;
/** A posted entry with one debit and one credit. Amounts are decimal strings, as in the API. */
function entry(over: Partial<PostedEntry> & { debit: [string, string]; credit: [string, string] }): PostedEntry {
  counter += 1;
  const { debit, credit, ...rest } = over;
  const amt = (account: string, side: "DEBIT" | "CREDIT", v: string) => ({
    account,
    side,
    amount: Money.fromDecimal(v, "USD"),
    baseAmount: Money.fromDecimal(v, "USD"),
    memo: null,
  });
  return {
    id: `e${counter}`,
    companyId: "c1",
    reference: `REF-${String(counter).padStart(5, "0")}`,
    date: "2026-11-05",
    periodId: "2026-11",
    currency: "USD",
    baseCurrency: "USD",
    memo: "note",
    reversalOf: null,
    postedAt: `2026-11-05T10:00:0${counter % 10}Z`,
    lines: [amt(debit[0], "DEBIT", debit[1]), amt(credit[0], "CREDIT", credit[1])],
    ...rest,
  } as PostedEntry;
}

describe("computeInsights", () => {
  it("counts entries of the month and those without a note", () => {
    const entries = [
      entry({ debit: ["1100", "100.00"], credit: ["4000", "100.00"], memo: null }),
      entry({ debit: ["1100", "50.00"], credit: ["4000", "50.00"], memo: "ok" }),
      entry({ debit: ["1100", "10.00"], credit: ["4000", "10.00"], date: "2026-10-30", memo: null }),
    ];
    const i = computeInsights({ entries, accounts, currency: "USD", today: "2026-11-10" });
    expect(i.entriesThisMonth).toBe(2);
    expect(i.entriesWithoutNote).toBe(1);
  });

  it("finds an exact repeat of date, amount and note, and ignores reversals", () => {
    const a = entry({ debit: ["6900", "20.00"], credit: ["1100", "20.00"], memo: "Taxi" });
    const b = entry({ debit: ["6900", "20.00"], credit: ["1100", "20.00"], memo: "  taxi " });
    const reversal = entry({ debit: ["1100", "20.00"], credit: ["6900", "20.00"], memo: "Taxi", reversalOf: a.id });
    const i = computeInsights({ entries: [a, b, reversal], accounts, currency: "USD", today: "2026-11-10" });
    expect(i.duplicates).toHaveLength(1);
    expect(i.duplicates[0]!.references).toEqual([a.reference, b.reference]);
  });

  it("does not flag the same amount with a different note or date", () => {
    const i = computeInsights({
      entries: [
        entry({ debit: ["6900", "20.00"], credit: ["1100", "20.00"], memo: "Taxi" }),
        entry({ debit: ["6900", "20.00"], credit: ["1100", "20.00"], memo: "Parking" }),
      ],
      accounts,
      currency: "USD",
      today: "2026-11-10",
    });
    expect(i.duplicates).toEqual([]);
  });

  it("reports the largest expense and an average rounded up to the cent, never a float", () => {
    const entries = [
      entry({ debit: ["6000", "900.00"], credit: ["1100", "900.00"], memo: "Rent" }),
      entry({ debit: ["6900", "100.00"], credit: ["1100", "100.00"], memo: "Fuel" }),
      entry({ debit: ["6900", "100.00"], credit: ["1100", "100.00"], memo: "Fuel 2" }),
    ];
    const i = computeInsights({ entries, accounts, currency: "USD", today: "2026-11-10" });
    expect(i.expenseCount).toBe(3);
    expect(i.largestExpense?.amount).toBe("900.00");
    expect(i.largestExpense?.reference).toBe(entries[0]!.reference);
    // 1,100.00 / 3 = 366.666..., rounded up to the cent.
    expect(i.averageExpense).toBe("366.67");
  });

  it("reports zero for everything when the books are empty", () => {
    const i = computeInsights({ entries: [], accounts, currency: "USD", today: "2026-11-10" });
    expect(i).toEqual({
      entriesThisMonth: 0,
      entriesWithoutNote: 0,
      expenseCount: 0,
      averageExpense: "0.00",
      largestExpense: null,
      duplicates: [],
      stock: "0.00",
      costOfSales: "0.00",
    });
  });

  it("reads stock and cost of sales from the normal balance, including after a reversal", () => {
    const stock = entry({ debit: ["1300", "300.00"], credit: ["1100", "300.00"], memo: "Stock in" });
    const cogs = entry({ debit: ["5000", "120.00"], credit: ["1300", "120.00"], memo: "Sold" });
    const undo = entry({ debit: ["1300", "120.00"], credit: ["5000", "120.00"], memo: "Undo sale", reversalOf: cogs.id });
    const i = computeInsights({ entries: [stock, cogs, undo], accounts, currency: "USD", today: "2026-11-10" });
    expect(i.stock).toBe("300.00");
    expect(i.costOfSales).toBe("0.00");
  });

  it("keeps zero-decimal currencies exact", () => {
    const yen = accounts.map((a) => a);
    const e = {
      ...entry({ debit: ["6900", "1"], credit: ["1100", "1"], memo: "Snack" }),
      lines: [
        { account: "6900", side: "DEBIT" as const, amount: Money.fromDecimal("1", "JPY"), baseAmount: Money.fromDecimal("1", "JPY"), memo: null },
        { account: "1100", side: "CREDIT" as const, amount: Money.fromDecimal("1", "JPY"), baseAmount: Money.fromDecimal("1", "JPY"), memo: null },
      ],
    };
    const i = computeInsights({ entries: [e as PostedEntry], accounts: yen, currency: "JPY", today: "2026-11-10" });
    expect(i.largestExpense?.amount).toBe("1");
  });
});

describe("balancesFor", () => {
  it("gives every account a balance, zero when it has no lines", () => {
    const balances = balancesFor(accounts, [], "USD");
    expect(balances.get("1100")!.toDecimal()).toBe("0.00");
    expect(balances.size).toBe(accounts.length);
  });
});
