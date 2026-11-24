import { describe, expect, it } from "vitest";
import { Money } from "@erp/money";
import { buildInvoiceEntry, buildInvoicePaymentEntry, postingReference, type InvoicePostingInput } from "../src";

const base = (over: Partial<InvoicePostingInput> = {}): InvoicePostingInput => ({
  number: "INV-1",
  customerName: "Acme Ltd",
  date: "2026-11-09",
  currency: "USD",
  receivableAccount: null,
  lines: [{ description: "Work", lineTotal: "100.00", revenueAccount: null }],
  taxTotal: "0.00",
  total: "100.00",
  version: 0,
  ...over,
});

function sides(lines: readonly { side: string; amount: Money }[], currency: string): { debit: bigint; credit: bigint } {
  let debit = 0n;
  let credit = 0n;
  for (const line of lines) {
    if (line.side === "DEBIT") debit += line.amount.minor;
    else credit += line.amount.minor;
  }
  void currency;
  return { debit, credit };
}

describe("buildInvoiceEntry", () => {
  it("debits receivables with the total and credits sales, using the starter chart by default", () => {
    const entry = buildInvoiceEntry(base());
    expect(entry.reference).toBe("INV-1");
    expect(entry.lines.map((l) => [l.account, l.side, l.amount.toDecimal()])).toEqual([
      ["1200", "DEBIT", "100.00"],
      ["4000", "CREDIT", "100.00"],
    ]);
  });

  it("credits tax payable and always balances", () => {
    const entry = buildInvoiceEntry(base({ lines: [{ description: "A", lineTotal: "80.00", revenueAccount: null }, { description: "B", lineTotal: "20.00", revenueAccount: null }], taxTotal: "18.00", total: "118.00" }));
    expect(entry.lines.map((l) => [l.account, l.side, l.amount.toDecimal()])).toEqual([
      ["1200", "DEBIT", "118.00"],
      ["4000", "CREDIT", "100.00"],
      ["2100", "CREDIT", "18.00"],
    ]);
    const { debit, credit } = sides(entry.lines, "USD");
    expect(debit).toBe(credit);
  });

  it("uses each item's income account and the party's receivable account, grouping equal accounts", () => {
    const entry = buildInvoiceEntry(base({
      receivableAccount: "1210",
      lines: [
        { description: "Goods", lineTotal: "60.00", revenueAccount: "4000" },
        { description: "Service", lineTotal: "30.00", revenueAccount: "4100" },
        { description: "More goods", lineTotal: "10.00", revenueAccount: "4000" },
      ],
    }));
    expect(entry.lines.map((l) => [l.account, l.side, l.amount.toDecimal()])).toEqual([
      ["1210", "DEBIT", "100.00"],
      ["4000", "CREDIT", "70.00"],
      ["4100", "CREDIT", "30.00"],
    ]);
  });

  it("handles zero-decimal and three-decimal currencies", () => {
    const yen = buildInvoiceEntry(base({ currency: "JPY", lines: [{ description: "x", lineTotal: "1500", revenueAccount: null }], taxTotal: "0", total: "1500" }));
    expect(yen.lines[0]?.amount.toDecimal()).toBe("1500");
    const dinar = buildInvoiceEntry(base({ currency: "KWD", lines: [{ description: "x", lineTotal: "1.234", revenueAccount: null }], taxTotal: "0.062", total: "1.296" }));
    const { debit, credit } = sides(dinar.lines, "KWD");
    expect(debit).toBe(1296n);
    expect(credit).toBe(1296n);
  });

  it("refuses a half-cent amount rather than rounding it", () => {
    expect(() => buildInvoiceEntry(base({ lines: [{ description: "x", lineTotal: "10.005", revenueAccount: null }], total: "10.01" }))).toThrow(/allows 2 decimal/);
    expect(() => buildInvoiceEntry(base({ currency: "JPY", lines: [{ description: "x", lineTotal: "10.5", revenueAccount: null }], taxTotal: "0", total: "11" }))).toThrow();
  });

  it("refuses lines and tax that do not add up to the total, and reports the three figures", () => {
    try {
      buildInvoiceEntry(base({ taxTotal: "10.00", total: "100.00" }));
      throw new Error("expected a refusal");
    } catch (error) {
      expect((error as { code?: string }).code).toBe("VALIDATION");
      expect((error as { details?: unknown }).details).toEqual({ lines: "100.00", tax: "10.00", total: "100.00" });
    }
  });

  it("refuses negative amounts, a zero total and an empty invoice", () => {
    expect(() => buildInvoiceEntry(base({ lines: [{ description: "x", lineTotal: "-5.00", revenueAccount: null }], total: "-5.00" }))).toThrow();
    expect(() => buildInvoiceEntry(base({ lines: [{ description: "x", lineTotal: "0.00", revenueAccount: null }], total: "0.00" }))).toThrow(/above zero/);
    expect(() => buildInvoiceEntry(base({ lines: [] }))).toThrow(/at least one line/);
  });

  it("gives each version its own reference, so a repost never collides with the original", () => {
    expect(postingReference("INV-1", 0)).toBe("INV-1");
    expect(postingReference("INV-1", 2)).toBe("INV-1/R2");
    expect(buildInvoiceEntry(base({ version: 1 })).reference).toBe("INV-1/R1");
  });

  it("balances for many mixes of lines and tax (no amount is lost or invented)", () => {
    for (let i = 1; i <= 200; i += 1) {
      const a = (i * 37) % 10_000;
      const b = (i * 91) % 5_000;
      const tax = Math.floor((a + b) * 0.07);
      const fmt = (minor: number) => Money.of(minor, "USD").toDecimal();
      const entry = buildInvoiceEntry(base({
        lines: [{ description: "a", lineTotal: fmt(a + 1), revenueAccount: "4000" }, { description: "b", lineTotal: fmt(b), revenueAccount: "4100" }],
        taxTotal: fmt(tax),
        total: fmt(a + 1 + b + tax),
      }));
      const { debit, credit } = sides(entry.lines, "USD");
      expect(debit).toBe(credit);
    }
  });
});

describe("buildInvoicePaymentEntry", () => {
  it("debits the bank by default and credits the receivable, with a numbered reference", () => {
    const entry = buildInvoicePaymentEntry({ number: "INV-1", customerName: "Acme", date: "2026-11-10", currency: "USD", receivableAccount: null, depositAccount: null, amount: "100.00", sequence: 1 });
    expect(entry.reference).toBe("INV-1/PAY/1");
    expect(entry.lines.map((l) => [l.account, l.side, l.amount.toDecimal()])).toEqual([
      ["1100", "DEBIT", "100.00"],
      ["1200", "CREDIT", "100.00"],
    ]);
  });
  it("can pay into cash and into a party's own receivable account, and refuses zero", () => {
    const entry = buildInvoicePaymentEntry({ number: "INV-1", customerName: "Acme", date: "2026-11-10", currency: "USD", receivableAccount: "1210", depositAccount: "1000", amount: "5.00", sequence: 2 });
    expect(entry.lines.map((l) => l.account)).toEqual(["1000", "1210"]);
    expect(() => buildInvoicePaymentEntry({ number: "INV-1", customerName: "A", date: "2026-11-10", currency: "USD", receivableAccount: null, depositAccount: null, amount: "0.00", sequence: 1 })).toThrow(/above zero/);
  });
});
