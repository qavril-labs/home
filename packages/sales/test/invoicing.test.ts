import { describe, expect, it } from "vitest";
import { DomainError, FixedClock } from "@erp/kernel";
import { InMemoryLedgerStore, Ledger } from "@erp/ledger";
import { Money } from "@erp/money";
import { InMemoryCounterStore, NumberingService } from "@erp/numbering";
import { SALES_INVOICE_SEQUENCE, SalesInvoicing, type InvoiceLine } from "../src";

const COMPANY = "11111111-1111-7111-8111-111111111111";
const TENANT = "22222222-2222-7222-8222-222222222222";
const clock = () => new FixedClock(new Date("2026-01-10T09:00:00Z"));
const kes = (decimal: string) => Money.fromDecimal(decimal, "KES");

async function setup() {
  const ledger = new Ledger(new InMemoryLedgerStore(), COMPANY, "KES", clock());
  await ledger.createAccount({ code: "1000", name: "Bank", type: "ASSET" });
  await ledger.createAccount({ code: "1200", name: "Receivables", type: "ASSET" });
  await ledger.createAccount({ code: "2100", name: "Tax payable", type: "LIABILITY" });
  await ledger.createAccount({ code: "4000", name: "Sales", type: "REVENUE" });
  await ledger.createFiscalYear(2026, 1);
  const numbering = new NumberingService(new InMemoryCounterStore(), [
    { key: SALES_INVOICE_SEQUENCE, prefix: "INV-", padding: 6, reset: "YEARLY" },
  ]);
  const sales = new SalesInvoicing(ledger, numbering, TENANT, "1200");
  return { ledger, sales };
}

const line = (description: string, amount: string, tax?: string): InvoiceLine => ({
  description,
  revenueAccount: "4000",
  amount: kes(amount),
  ...(tax ? { tax: kes(tax), taxAccount: "2100" } : {}),
});

async function balance(ledger: Ledger, account: string, asOf = "2026-12-31") {
  const row = (await ledger.trialBalance(asOf)).rows.find((item) => item.account === account);
  return { debit: row?.debit.toDecimal() ?? "0.00", credit: row?.credit.toDecimal() ?? "0.00" };
}

describe("issuing invoices", () => {
  it("numbers invoices in sequence and posts a balanced entry", async () => {
    const { ledger, sales } = await setup();
    const first = await sales.issue({ customer: "Blue Hills Cafe", date: "2026-01-15", currency: "KES", lines: [line("Coffee beans", "1000.00", "160.00")] });
    const second = await sales.issue({ customer: "Kamau Stores", date: "2026-01-16", currency: "KES", lines: [line("Milk", "250.00")] });

    expect(first.number).toBe("INV-2026-000001");
    expect(second.number).toBe("INV-2026-000002");
    expect(first.total.toDecimal()).toBe("1160.00");
    expect(first.tax.toDecimal()).toBe("160.00");
    expect(first.status).toBe("OPEN");

    expect(await balance(ledger, "1200")).toEqual({ debit: "1410.00", credit: "0.00" });
    expect(await balance(ledger, "4000")).toEqual({ debit: "0.00", credit: "1250.00" });
    expect(await balance(ledger, "2100")).toEqual({ debit: "0.00", credit: "160.00" });
  });

  it("rejects tax without a tax account", async () => {
    const { sales } = await setup();
    await expect(
      sales.issue({
        customer: "Blue Hills Cafe",
        date: "2026-01-15",
        currency: "KES",
        lines: [{ description: "Tea", revenueAccount: "4000", amount: kes("100.00"), tax: kes("16.00") }],
      }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("rejects empty invoices, zero amounts and a line in another currency", async () => {
    const { sales } = await setup();
    await expect(sales.issue({ customer: "A", date: "2026-01-15", currency: "KES", lines: [] })).rejects.toBeInstanceOf(DomainError);
    await expect(sales.issue({ customer: "A", date: "2026-01-15", currency: "KES", lines: [line("Free", "0.00")] })).rejects.toBeInstanceOf(DomainError);
    await expect(
      sales.issue({
        customer: "A",
        date: "2026-01-15",
        currency: "KES",
        lines: [{ description: "Dollar item", revenueAccount: "4000", amount: Money.fromDecimal("10.00", "USD") }],
      }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
  });
});

describe("payments", () => {
  it("settles an invoice in two payments and marks it paid", async () => {
    const { ledger, sales } = await setup();
    const invoice = await sales.issue({ customer: "Kamau Stores", date: "2026-01-15", currency: "KES", lines: [line("Milk", "600.00")] });

    const partial = await sales.recordPayment({ invoice: invoice.number, date: "2026-01-20", amount: kes("250.00"), bankAccount: "1000" });
    expect(partial.status).toBe("OPEN");
    expect(partial.settled.toDecimal()).toBe("250.00");

    const final = await sales.recordPayment({ invoice: invoice.number, date: "2026-01-25", amount: kes("350.00"), bankAccount: "1000" });
    expect(final.status).toBe("PAID");
    expect(await balance(ledger, "1200")).toEqual({ debit: "600.00", credit: "600.00" });
    expect(await balance(ledger, "1000")).toEqual({ debit: "600.00", credit: "0.00" });
  });

  it("refuses more than the amount outstanding and says how much is owed", async () => {
    const { sales } = await setup();
    const invoice = await sales.issue({ customer: "Kamau Stores", date: "2026-01-15", currency: "KES", lines: [line("Milk", "100.00")] });
    await expect(
      sales.recordPayment({ invoice: invoice.number, date: "2026-01-20", amount: kes("100.01"), bankAccount: "1000" }),
    ).rejects.toMatchObject({ code: "VALIDATION", details: { outstanding: "100.00" } });
  });

  it("refuses a zero or negative payment", async () => {
    const { sales } = await setup();
    const invoice = await sales.issue({ customer: "Kamau Stores", date: "2026-01-15", currency: "KES", lines: [line("Milk", "100.00")] });
    await expect(sales.recordPayment({ invoice: invoice.number, date: "2026-01-20", amount: kes("0.00"), bankAccount: "1000" })).rejects.toBeInstanceOf(DomainError);
    await expect(sales.recordPayment({ invoice: invoice.number, date: "2026-01-20", amount: kes("-5.00"), bankAccount: "1000" })).rejects.toBeInstanceOf(DomainError);
  });

  it("refuses a payment for an invoice that does not exist", async () => {
    const { sales } = await setup();
    await expect(sales.recordPayment({ invoice: "INV-2026-000099", date: "2026-01-20", amount: kes("1.00"), bankAccount: "1000" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("voiding", () => {
  it("reverses the entry so receivables and income return to zero", async () => {
    const { ledger, sales } = await setup();
    const invoice = await sales.issue({ customer: "Blue Hills Cafe", date: "2026-01-15", currency: "KES", lines: [line("Tea", "100.00", "16.00")] });
    const voided = await sales.void(invoice.number, "2026-01-16");

    expect(voided.status).toBe("VOID");
    expect(await balance(ledger, "1200")).toEqual({ debit: "116.00", credit: "116.00" });
    expect(await balance(ledger, "4000")).toEqual({ debit: "100.00", credit: "100.00" });
    expect(sales.outstanding()).toHaveLength(0);
  });

  it("refuses to void an invoice that has been paid in part", async () => {
    const { sales } = await setup();
    const invoice = await sales.issue({ customer: "Kamau Stores", date: "2026-01-15", currency: "KES", lines: [line("Milk", "100.00")] });
    await sales.recordPayment({ invoice: invoice.number, date: "2026-01-20", amount: kes("10.00"), bankAccount: "1000" });
    await expect(sales.void(invoice.number, "2026-01-21")).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("refuses to void twice and refuses payments on a void invoice", async () => {
    const { sales } = await setup();
    const invoice = await sales.issue({ customer: "Kamau Stores", date: "2026-01-15", currency: "KES", lines: [line("Milk", "100.00")] });
    await sales.void(invoice.number, "2026-01-16");
    await expect(sales.void(invoice.number, "2026-01-17")).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(sales.recordPayment({ invoice: invoice.number, date: "2026-01-18", amount: kes("1.00"), bankAccount: "1000" })).rejects.toMatchObject({ code: "CONFLICT" });
  });
});

describe("rounding", () => {
  it("keeps half-cent-free totals exact when tax is added to odd amounts", async () => {
    const { sales } = await setup();
    const invoice = await sales.issue({
      customer: "Odd Amounts Ltd",
      date: "2026-01-15",
      currency: "KES",
      lines: [line("Item A", "33.33", "5.33"), line("Item B", "0.01", "0.00")],
    });
    expect(invoice.total.toDecimal()).toBe("38.67");
    expect(invoice.tax.toDecimal()).toBe("5.33");
  });
});
