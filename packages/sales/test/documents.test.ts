import { describe, expect, it } from "vitest";
import { DomainError, FixedClock } from "@erp/kernel";
import { InMemoryLedgerStore, Ledger } from "@erp/ledger";
import { Money } from "@erp/money";
import { InMemoryCounterStore, NumberingService } from "@erp/numbering";
import { CREDIT_NOTE_SEQUENCE, SALES_INVOICE_SEQUENCE, SalesInvoicing, SALES_QUOTE_SEQUENCE, SalesQuotes, type InvoiceLine } from "../src";

const COMPANY = "11111111-1111-7111-8111-111111111111";
const TENANT = "22222222-2222-7222-8222-222222222222";
const clock = () => new FixedClock(new Date("2026-01-10T09:00:00Z"));
const kes = (decimal: string) => Money.fromDecimal(decimal, "KES");

async function setup() {
  const ledger = new Ledger(new InMemoryLedgerStore(), COMPANY, "KES", clock());
  for (const [code, name, type] of [
    ["1000", "Bank", "ASSET"],
    ["1200", "Receivables", "ASSET"],
    ["2100", "Tax payable", "LIABILITY"],
    ["4000", "Sales", "REVENUE"],
  ] as const) {
    await ledger.createAccount({ code, name, type });
  }
  await ledger.createFiscalYear(2026, 1);
  const numbering = new NumberingService(new InMemoryCounterStore(), [
    { key: SALES_INVOICE_SEQUENCE, prefix: "INV-", padding: 6, reset: "YEARLY" },
    { key: CREDIT_NOTE_SEQUENCE, prefix: "CN-", padding: 6, reset: "YEARLY" },
    { key: SALES_QUOTE_SEQUENCE, prefix: "QUO-", padding: 6, reset: "YEARLY" },
  ]);
  const sales = new SalesInvoicing(ledger, numbering, TENANT, "1200");
  const quotes = new SalesQuotes(sales, numbering, TENANT);
  return { ledger, sales, quotes };
}

const line = (description: string, amount: string, tax?: string): InvoiceLine => ({
  description,
  revenueAccount: "4000",
  amount: kes(amount),
  ...(tax ? { tax: kes(tax), taxAccount: "2100" } : {}),
});

async function balance(ledger: Ledger, account: string) {
  const row = (await ledger.trialBalance("2026-12-31")).rows.find((item) => item.account === account);
  return { debit: row?.debit.toDecimal() ?? "0.00", credit: row?.credit.toDecimal() ?? "0.00" };
}

describe("credit notes", () => {
  it("credits part of an invoice, reduces what is owed, and keeps the invoice open", async () => {
    const { ledger, sales } = await setup();
    const invoice = await sales.issue({ customerId: "c-1", customer: "Blue Hills", date: "2026-01-15", currency: "KES", lines: [line("Tea", "100.00", "16.00")] });
    const note = await sales.creditNote({ invoice: invoice.number, date: "2026-01-20", lines: [line("Tea returned", "50.00", "8.00")] });

    expect(note.number).toBe("CN-2026-000001");
    expect(note.total.toDecimal()).toBe("58.00");
    expect(await balance(ledger, "1200")).toEqual({ debit: "116.00", credit: "58.00" });
    expect(await balance(ledger, "4000")).toEqual({ debit: "50.00", credit: "100.00" });
    const after = await sales.get(invoice.number);
    expect(after).toMatchObject({ status: "OPEN" });
    expect(after?.credited.toDecimal()).toBe("58.00");
    expect(SalesInvoicing.outstandingOf(after!).toDecimal()).toBe("58.00");
  });

  it("marks the invoice paid when payments and credits together cover it", async () => {
    const { sales } = await setup();
    const invoice = await sales.issue({ customerId: "c-1", customer: "Blue Hills", date: "2026-01-15", currency: "KES", lines: [line("Tea", "100.00", "16.00")] });
    await sales.recordPayment({ invoice: invoice.number, date: "2026-01-16", amount: kes("60.00"), bankAccount: "1000" });
    await sales.creditNote({ invoice: invoice.number, date: "2026-01-17", lines: [line("Refund", "40.00", "16.00")] });
    expect((await sales.get(invoice.number))?.status).toBe("PAID");
  });

  it("refuses a credit above the amount still owed", async () => {
    const { sales } = await setup();
    const invoice = await sales.issue({ customerId: "c-1", customer: "Blue Hills", date: "2026-01-15", currency: "KES", lines: [line("Tea", "100.00")] });
    await expect(sales.creditNote({ invoice: invoice.number, date: "2026-01-16", lines: [line("Too much", "100.01")] })).rejects.toMatchObject({
      code: "VALIDATION",
      details: { outstanding: "100.00" },
    });
  });

  it("blocks voiding an invoice that has a credit note", async () => {
    const { sales } = await setup();
    const invoice = await sales.issue({ customerId: "c-1", customer: "Blue Hills", date: "2026-01-15", currency: "KES", lines: [line("Tea", "100.00")] });
    await sales.creditNote({ invoice: invoice.number, date: "2026-01-16", lines: [line("Part", "10.00")] });
    await expect(sales.void(invoice.number, "2026-01-17")).rejects.toMatchObject({ code: "CONFLICT" });
  });
});

describe("quotes", () => {
  it("creates a quote with a total and no ledger entry", async () => {
    const { ledger, quotes } = await setup();
    const quote = await quotes.create({ customerId: "c-1", customer: "Kamau Stores", date: "2026-01-05", currency: "KES", lines: [line("Milk", "250.00", "40.00")] });
    expect(quote.number).toBe("QUO-2026-000001");
    expect(quote.total.toDecimal()).toBe("290.00");
    expect(quote.status).toBe("OPEN");
    expect(await balance(ledger, "1200")).toEqual({ debit: "0.00", credit: "0.00" });
  });

  it("accepting a quote issues an invoice with the same lines, once", async () => {
    const { sales, quotes } = await setup();
    const quote = await quotes.create({ customerId: "c-1", customer: "Kamau Stores", date: "2026-01-05", currency: "KES", lines: [line("Milk", "250.00", "40.00")] });
    const invoice = await quotes.accept(quote.number, { date: "2026-01-06", receivableAccount: "1200" });
    expect(invoice.total.toDecimal()).toBe("290.00");
    expect(invoice.customerId).toBe("c-1");
    expect((await quotes.get(quote.number))).toMatchObject({ status: "ACCEPTED", invoice: invoice.number });
    await expect(quotes.accept(quote.number, { date: "2026-01-07", receivableAccount: "1200" })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(await sales.get(invoice.number)).toBeDefined();
  });

  it("cancels an open quote and refuses to accept a cancelled one", async () => {
    const { quotes } = await setup();
    const quote = await quotes.create({ customerId: "c-1", customer: "Kamau Stores", date: "2026-01-05", currency: "KES", lines: [line("Milk", "250.00")] });
    expect((await quotes.cancel(quote.number)).status).toBe("CANCELLED");
    await expect(quotes.accept(quote.number, { date: "2026-01-07", receivableAccount: "1200" })).rejects.toBeInstanceOf(DomainError);
  });
});
