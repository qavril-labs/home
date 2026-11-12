import { describe, expect, it } from "vitest";
import { DomainError, FixedClock } from "@erp/kernel";
import { Money } from "@erp/money";
import { InMemoryLedgerStore, Ledger, monthlyPeriods, periodContaining, type PostEntryInput } from "../src";

const COMPANY = "11111111-1111-7111-8111-111111111111";
const clock = () => new FixedClock(new Date("2026-01-10T09:00:00Z"));
const kes = (decimal: string) => Money.fromDecimal(decimal, "KES");

async function setup() {
  const store = new InMemoryLedgerStore();
  const ledger = new Ledger(store, COMPANY, "KES", clock());
  await ledger.createAccount({ code: "1000", name: "Cash", type: "ASSET" });
  await ledger.createAccount({ code: "4000", name: "Sales", type: "REVENUE" });
  await ledger.createFiscalYear(2026, 1);
  return { store, ledger };
}

const sale = (reference: string, amount: string, date = "2026-01-15"): PostEntryInput => ({
  reference,
  date,
  currency: "KES",
  lines: [
    { account: "1000", side: "DEBIT", amount: kes(amount) },
    { account: "4000", side: "CREDIT", amount: kes(amount) },
  ],
});

describe("fiscal periods", () => {
  it("creates twelve months starting in the given month", () => {
    const periods = monthlyPeriods(2026, 7);
    expect(periods).toHaveLength(12);
    expect(periods[0]).toMatchObject({ id: "2026-07", startDate: "2026-07-01", endDate: "2026-07-31" });
    expect(periods[11]).toMatchObject({ id: "2027-06", startDate: "2027-06-01", endDate: "2027-06-30" });
  });

  it("uses the leap day in February", () => {
    const february = monthlyPeriods(2028, 2)[0]!;
    expect(february.endDate).toBe("2028-02-29");
  });

  it("finds the period covering a date and rejects dates outside the year", () => {
    const periods = monthlyPeriods(2026, 1);
    expect(periodContaining(periods, "2026-03-31").id).toBe("2026-03");
    expect(() => periodContaining(periods, "2027-01-01")).toThrow(/No fiscal period covers/);
  });
});

describe("Ledger", () => {
  it("posts a balanced entry and reports matching trial balance totals", async () => {
    const { ledger } = await setup();
    const entry = await ledger.post(sale("INV-1", "1000.00"));
    expect(entry.periodId).toBe("2026-01");

    const trial = await ledger.trialBalance("2026-12-31");
    expect(trial.totalDebit.toDecimal()).toBe("1000.00");
    expect(trial.totalCredit.toDecimal()).toBe("1000.00");
    expect(trial.rows.find((row) => row.account === "1000")?.debit.toDecimal()).toBe("1000.00");
  });

  it("rejects an entry that does not balance", async () => {
    const { ledger } = await setup();
    const unbalanced: PostEntryInput = {
      reference: "BAD-1",
      date: "2026-01-15",
      currency: "KES",
      lines: [
        { account: "1000", side: "DEBIT", amount: kes("100.00") },
        { account: "4000", side: "CREDIT", amount: kes("90.00") },
      ],
    };
    await expect(ledger.post(unbalanced)).rejects.toThrow(/does not balance/);
  });

  it("rejects unknown accounts and non-positive amounts", async () => {
    const { ledger } = await setup();
    const unknown = { ...sale("X-1", "10.00"), lines: [
      { account: "9999", side: "DEBIT" as const, amount: kes("10.00") },
      { account: "4000", side: "CREDIT" as const, amount: kes("10.00") },
    ] };
    await expect(ledger.post(unknown)).rejects.toThrow(/Unknown account 9999/);

    const negative = { ...sale("X-2", "10.00"), lines: [
      { account: "1000", side: "DEBIT" as const, amount: Money.of(-1000, "KES") },
      { account: "4000", side: "CREDIT" as const, amount: Money.of(-1000, "KES") },
    ] };
    await expect(ledger.post(negative)).rejects.toThrow(/must be positive/);
  });

  it("rejects dates outside any period", async () => {
    const { ledger } = await setup();
    await expect(ledger.post(sale("OUT-1", "10.00", "2027-02-01"))).rejects.toThrow(/No fiscal period covers/);
  });

  it("rejects postings into a closed period and accepts the next one", async () => {
    const { ledger } = await setup();
    await ledger.closePeriod("2026-01");
    await expect(ledger.post(sale("JAN-1", "10.00", "2026-01-15"))).rejects.toThrow(/is closed/);
    const february = await ledger.post(sale("FEB-1", "10.00", "2026-02-03"));
    expect(february.periodId).toBe("2026-02");
  });

  it("returns the stored entry for a safe retry and rejects a reused reference", async () => {
    const { ledger } = await setup();
    const first = await ledger.post(sale("INV-7", "500.00"));
    const retry = await ledger.post(sale("INV-7", "500.00"));
    expect(retry.id).toBe(first.id);
    await expect(ledger.post(sale("INV-7", "600.00"))).rejects.toThrow(/already used for a different entry/);
  });

  it("posts in a foreign currency at the rate in effect on the entry date", async () => {
    const { ledger } = await setup();
    await ledger.setRate({ base: "USD", quote: "KES", effectiveDate: "2026-01-01", rate: "130" });
    const usd = (decimal: string) => Money.fromDecimal(decimal, "USD");
    const entry = await ledger.post({
      reference: "USD-1",
      date: "2026-01-15",
      currency: "USD",
      lines: [
        { account: "1000", side: "DEBIT", amount: usd("100.00") },
        { account: "4000", side: "CREDIT", amount: usd("100.00") },
      ],
    });
    expect(entry.lines[0]?.baseAmount.toDecimal()).toBe("13000.00");
    expect(entry.lines[0]?.baseAmount.currency).toBe("KES");

    const trial = await ledger.trialBalance("2026-12-31");
    expect(trial.totalDebit.toDecimal()).toBe("13000.00");
  });

  it("rejects an entry that balances in its currency but not after conversion", async () => {
    const { ledger } = await setup();
    await ledger.setRate({ base: "USD", quote: "KES", effectiveDate: "2026-01-01", rate: "1.25" });
    const usd = (minor: number) => Money.of(minor, "USD");
    const mismatch: PostEntryInput = {
      reference: "FX-ROUND-1",
      date: "2026-01-15",
      currency: "USD",
      lines: [
        { account: "1000", side: "DEBIT", amount: usd(1) },
        { account: "1000", side: "DEBIT", amount: usd(1) },
        { account: "4000", side: "CREDIT", amount: usd(2) },
      ],
    };
    await expect(ledger.post(mismatch)).rejects.toThrow(/Converted to KES/);
  });

  it("reverses an entry at its original base amounts even after the rate changes", async () => {
    const { ledger } = await setup();
    await ledger.setRate({ base: "USD", quote: "KES", effectiveDate: "2026-01-01", rate: "130" });
    const usd = (decimal: string) => Money.fromDecimal(decimal, "USD");
    const original = await ledger.post({
      reference: "USD-2",
      date: "2026-01-15",
      currency: "USD",
      lines: [
        { account: "1000", side: "DEBIT", amount: usd("100.00") },
        { account: "4000", side: "CREDIT", amount: usd("100.00") },
      ],
    });
    await ledger.setRate({ base: "USD", quote: "KES", effectiveDate: "2026-02-01", rate: "150" });

    await ledger.reverse(original.id, { reference: "USD-2-REV", date: "2026-02-05" });
    const trial = await ledger.trialBalance("2026-12-31");
    const cash = trial.rows.find((row) => row.account === "1000");
    expect(cash?.debit.toDecimal()).toBe("13000.00");
    expect(cash?.credit.toDecimal()).toBe("13000.00");
  });

  it("allows one reversal per entry and does not reverse a reversal", async () => {
    const { ledger } = await setup();
    const entry = await ledger.post(sale("A-1", "250.00"));
    const reversal = await ledger.reverse(entry.id, { reference: "A-1-REV", date: "2026-01-20" });
    await expect(ledger.reverse(entry.id, { reference: "A-1-REV2", date: "2026-01-21" })).rejects.toThrow(
      /already been reversed/,
    );
    await expect(ledger.reverse(reversal.id, { reference: "A-1-REV3", date: "2026-01-22" })).rejects.toThrow(
      /cannot be reversed/,
    );
  });

  it("keeps trial balance totals equal after reversals", async () => {
    const { ledger } = await setup();
    const entry = await ledger.post(sale("B-1", "75.00"));
    await ledger.reverse(entry.id, { reference: "B-1-REV", date: "2026-01-20" });
    const trial = await ledger.trialBalance("2026-12-31");
    expect(trial.totalDebit.equals(trial.totalCredit)).toBe(true);
    const cash = trial.rows.find((row) => row.account === "1000");
    expect(cash?.debit.equals(cash?.credit ?? Money.zero("KES"))).toBe(true);
  });

  it("reports the trial balance as at a date", async () => {
    const { ledger } = await setup();
    await ledger.post(sale("C-1", "100.00", "2026-01-10"));
    await ledger.post(sale("C-2", "300.00", "2026-03-10"));
    const march = await ledger.trialBalance("2026-01-31");
    expect(march.totalDebit.toDecimal()).toBe("100.00");
  });

  it("rejects duplicate accounts, invalid account types, and overlapping fiscal years", async () => {
    const { ledger } = await setup();
    await expect(ledger.createAccount({ code: "1000", name: "Again", type: "ASSET" })).rejects.toThrow(/already exists/);
    await expect(ledger.createAccount({ code: "5000", name: "Odd", type: "BOGUS" })).rejects.toThrow(DomainError);
    await expect(ledger.createFiscalYear(2026, 1)).rejects.toThrow(/already exists/);
  });

  it("validates the reference and requires at least two lines", async () => {
    const { ledger } = await setup();
    await expect(ledger.post({ ...sale("   ", "10.00") })).rejects.toThrow(/Reference must be/);
    await expect(ledger.post({ ...sale("ONE-LINE", "10.00"), lines: [sale("x", "1.00").lines[0]!] })).rejects.toThrow(
      /at least two lines/,
    );
  });
});
