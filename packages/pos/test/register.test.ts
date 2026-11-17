import { describe, expect, it } from "vitest";
import { DomainError, FixedClock, newId } from "@erp/kernel";
import { Inventory, InMemoryInventoryStore, type InventoryAccounts } from "@erp/inventory";
import { InMemoryLedgerStore, Ledger } from "@erp/ledger";
import { Money } from "@erp/money";
import { InMemoryCounterStore, NumberingService } from "@erp/numbering";
import {
  InMemoryPosStore,
  POS_SALE_SEQUENCE,
  PosRegister,
  type SaleInput,
  type SaleLineInput,
  type Tender,
} from "../src";

const COMPANY = "11111111-1111-7111-8111-111111111111";
const TENANT = "22222222-2222-7222-8222-222222222222";
const WAREHOUSE = "COUNTER";
const STOCK_ACCOUNTS: InventoryAccounts = { inventory: "1300", clearing: "2050", cogs: "5000", writeOff: "5100" };
const kes = (decimal: string) => Money.fromDecimal(decimal, "KES");

async function setup() {
  const clock = new FixedClock(new Date("2026-03-01T09:00:00Z"));
  const ledger = new Ledger(new InMemoryLedgerStore(), COMPANY, "KES", clock);
  for (const [code, name, type] of [
    ["1000", "Cash", "ASSET"],
    ["1010", "Card clearing", "ASSET"],
    ["1020", "Mobile money clearing", "ASSET"],
    ["1300", "Stock on hand", "ASSET"],
    ["2050", "Goods received not invoiced", "LIABILITY"],
    ["2100", "Tax payable", "LIABILITY"],
    ["4000", "Sales", "REVENUE"],
    ["5000", "Cost of goods sold", "EXPENSE"],
    ["5100", "Expired stock written off", "EXPENSE"],
  ] as const) {
    await ledger.createAccount({ code, name, type });
  }
  await ledger.createFiscalYear(2026, 1);

  const inventory = new Inventory({
    store: new InMemoryInventoryStore(),
    posting: { ledger, accounts: STOCK_ACCOUNTS },
    clock,
  });
  const numbering = new NumberingService(new InMemoryCounterStore(), [
    { key: POS_SALE_SEQUENCE, prefix: "POS-", padding: 6, reset: "YEARLY" },
  ]);
  const store = new InMemoryPosStore();
  const register = new PosRegister({
    tenantId: TENANT,
    store,
    inventory,
    ledger,
    numbering,
    accounts: { tenders: { CASH: "1000", CARD: "1010", MOBILE: "1020" }, taxPayable: "2100" },
    clock,
  });
  return { ledger, inventory, register, store };
}

function receive(inventory: Inventory, item: string, batchNo: string, expiresOn: string, qty: bigint, cost: string) {
  return inventory.receive({
    companyId: COMPANY,
    warehouse: WAREHOUSE,
    item,
    batchNo,
    expiresOn,
    qty,
    unitCost: kes(cost),
    date: "2026-03-01",
    reference: `GRN-${item}-${batchNo}`,
  });
}

function item(code: string, qty: bigint, price: string, overrides: Partial<SaleLineInput> = {}): SaleLineInput {
  return {
    itemCode: code,
    description: code,
    qty,
    unitPrice: kes(price),
    taxRateBps: 1900n,
    taxMode: "EXCLUSIVE",
    revenueAccount: "4000",
    tracked: true,
    ...overrides,
  };
}

function sale(overrides: Partial<SaleInput> = {}): SaleInput {
  return {
    id: newId(),
    companyId: COMPANY,
    warehouse: WAREHOUSE,
    date: "2026-03-05",
    currency: "KES",
    lines: [item("PARA-500", 1n, "10.00")],
    tenders: [{ method: "CASH", amount: kes("11.90") }],
    ...overrides,
  };
}

async function balance(ledger: Ledger, account: string) {
  const row = (await ledger.trialBalance("2026-12-31")).rows.find((r) => r.account === account);
  return { debit: row?.debit.toDecimal() ?? "0.00", credit: row?.credit.toDecimal() ?? "0.00" };
}

describe("posting a sale", () => {
  it("issues stock first to expire, numbers the receipt, and posts a balanced ledger entry", async () => {
    const { ledger, inventory, register } = await setup();
    await receive(inventory, "PARA-500", "EARLY", "2026-06-30", 30n, "2.50");
    await receive(inventory, "PARA-500", "LATE", "2026-12-31", 50n, "3.00");
    const tenders: Tender[] = [
      { method: "CASH", amount: kes("300.00") },
      { method: "CARD", amount: kes("176.00") },
    ];
    const id = newId();

    const result = await register.record(sale({ id, lines: [item("PARA-500", 40n, "10.00")], tenders }));

    expect(result.duplicate).toBe(false);
    expect(result.sale).toMatchObject({ status: "POSTED", number: "POS-2026-000001", warehouse: WAREHOUSE });
    expect(result.sale.total.toDecimal()).toBe("476.00");
    expect(result.sale.tax.toDecimal()).toBe("76.00");
    expect(result.sale.cost?.toDecimal()).toBe("105.00");
    expect(await balance(ledger, "1000")).toEqual({ debit: "300.00", credit: "0.00" });
    expect(await balance(ledger, "1010")).toEqual({ debit: "176.00", credit: "0.00" });
    expect(await balance(ledger, "4000")).toEqual({ debit: "0.00", credit: "400.00" });
    expect(await balance(ledger, "2100")).toEqual({ debit: "0.00", credit: "76.00" });
    expect(await balance(ledger, "5000")).toEqual({ debit: "105.00", credit: "0.00" });
    expect(await balance(ledger, "1300")).toEqual({ debit: "225.00", credit: "105.00" });
    expect(await ledger.entryByReference(`POS-SALE/${id}`)).toBeDefined();
  });

  it("gives change back in cash, so the cash account receives only what it keeps", async () => {
    const { ledger, register } = await setup();
    const result = await register.record(
      sale({ lines: [item("SOAP", 1n, "50.00", { tracked: false, taxRateBps: 0n })], tenders: [{ method: "CASH", amount: kes("60.00") }] }),
    );

    expect(result.sale.status).toBe("POSTED");
    expect(result.sale.change.toDecimal()).toBe("10.00");
    expect(await balance(ledger, "1000")).toEqual({ debit: "50.00", credit: "0.00" });
    expect(await balance(ledger, "4000")).toEqual({ debit: "0.00", credit: "50.00" });
  });

  it("refuses to post a sale whose total is zero", async () => {
    const { register } = await setup();
    await expect(register.record(sale({ lines: [item("FREE", 1n, "0.00", { tracked: false, taxRateBps: 0n })], tenders: [{ method: "CASH", amount: kes("0.01") }] }))).rejects.toMatchObject({
      code: "VALIDATION",
    });
  });

  it("refuses a sale id that is not a UUID", async () => {
    const { register } = await setup();
    await expect(register.record(sale({ id: "sale-1" }))).rejects.toMatchObject({ code: "VALIDATION" });
  });
});

describe("keeping a sale for review instead of losing it", () => {
  it("keeps a short payment for review, with no stock moved and nothing posted", async () => {
    const { ledger, inventory, register, store } = await setup();
    await receive(inventory, "PARA-500", "A", "2026-12-31", 10n, "2.50");

    const result = await register.record(sale({ lines: [item("PARA-500", 1n, "100.00")], tenders: [{ method: "CARD", amount: kes("100.00") }] }));

    expect(result.sale.status).toBe("NEEDS_REVIEW");
    expect(result.sale.number).toBeNull();
    expect(result.sale.reasons).toEqual(["PAYMENT_SHORT"]);
    expect(await inventory.available(COMPANY, WAREHOUSE, "PARA-500", "2026-03-05")).toBe(10n);
    expect(await balance(ledger, "4000")).toEqual({ debit: "0.00", credit: "0.00" });
    expect(await store.list(COMPANY, "NEEDS_REVIEW")).toHaveLength(1);
  });

  it("keeps change that no cash can cover for review", async () => {
    const { register } = await setup();
    const result = await register.record(sale({ lines: [item("SOAP", 1n, "100.00", { tracked: false, taxRateBps: 0n })], tenders: [{ method: "CARD", amount: kes("120.00") }] }));
    expect(result.sale.status).toBe("NEEDS_REVIEW");
    expect(result.sale.reasons).toEqual(["CHANGE_NOT_FROM_CASH"]);
  });

  it("keeps a sale for review when the unexpired stock is not enough, and never takes expired batches", async () => {
    const { inventory, register } = await setup();
    await receive(inventory, "PARA-500", "OLD", "2026-03-10", 10n, "2.50");
    await receive(inventory, "PARA-500", "NEW", "2026-12-31", 5n, "2.50");

    // On 11 March the OLD batch has expired, so only the 5 units of NEW can be sold.
    const result = await register.record(sale({ date: "2026-03-11", lines: [item("PARA-500", 8n, "10.00")], tenders: [{ method: "CASH", amount: kes("100.00") }] }));

    expect(result.sale.status).toBe("NEEDS_REVIEW");
    expect(result.sale.reasons.some((reason) => reason.startsWith("STOCK_SHORT"))).toBe(true);
    expect(await inventory.available(COMPANY, WAREHOUSE, "PARA-500", "2026-03-11")).toBe(5n);
  });

  it("refuses the whole sale when its second line does not fit, so the first line is not taken either", async () => {
    const { inventory, register } = await setup();
    await receive(inventory, "PARA-500", "A", "2026-12-31", 10n, "2.50");

    const result = await register.record(
      sale({ lines: [item("PARA-500", 6n, "10.00"), item("PARA-500", 6n, "10.00")], tenders: [{ method: "CASH", amount: kes("250.00") }] }),
    );

    expect(result.sale.status).toBe("NEEDS_REVIEW");
    expect(await inventory.available(COMPANY, WAREHOUSE, "PARA-500", "2026-03-05")).toBe(10n);
  });

  it("lists the sales waiting for review, for reconciliation", async () => {
    const { inventory, register } = await setup();
    await receive(inventory, "PARA-500", "A", "2026-12-31", 10n, "2.50");
    await register.record(sale({ tenders: [{ method: "CASH", amount: kes("1.00") }] }));
    await register.record(sale());

    const waiting = await register.sales(COMPANY, "NEEDS_REVIEW");
    expect(waiting).toHaveLength(1);
    expect(waiting[0]?.reasons).toEqual(["PAYMENT_SHORT"]);
  });
});

describe("syncing the same sale twice (offline devices)", () => {
  it("stores a sale once: the second sync returns the stored sale and takes no more stock", async () => {
    const { inventory, register } = await setup();
    await receive(inventory, "PARA-500", "A", "2026-12-31", 10n, "2.50");
    const input = sale({ lines: [item("PARA-500", 4n, "10.00")], tenders: [{ method: "CASH", amount: kes("47.60") }] });

    const first = await register.record(input);
    const again = await register.record(input);

    expect(again.duplicate).toBe(true);
    expect(again.sale.number).toBe(first.sale.number);
    expect(await inventory.available(COMPANY, WAREHOUSE, "PARA-500", "2026-03-05")).toBe(6n);
  });

  it("gives each posted sale its own receipt number", async () => {
    const { inventory, register } = await setup();
    await receive(inventory, "PARA-500", "A", "2026-12-31", 10n, "2.50");
    const first = await register.record(sale({ lines: [item("PARA-500", 1n, "10.00")], tenders: [{ method: "CASH", amount: kes("11.90") }] }));
    const second = await register.record(sale({ lines: [item("PARA-500", 1n, "10.00")], tenders: [{ method: "CASH", amount: kes("11.90") }] }));

    expect([first.sale.number, second.sale.number]).toEqual(["POS-2026-000001", "POS-2026-000002"]);
  });
});
