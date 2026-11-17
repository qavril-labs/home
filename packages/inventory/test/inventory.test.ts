import { describe, expect, it } from "vitest";
import { FixedClock } from "@erp/kernel";
import { InMemoryLedgerStore, Ledger } from "@erp/ledger";
import { Money } from "@erp/money";
import { Inventory, InMemoryInventoryStore, daysBetween, type InventoryAccounts, type ReceiveInput } from "../src";

const COMPANY = "11111111-1111-7111-8111-111111111111";
const WAREHOUSE = "MAIN";
const ITEM = "PARA-500";
const ACCOUNTS: InventoryAccounts = { inventory: "1300", clearing: "2050", cogs: "5000", writeOff: "5100" };
const kes = (decimal: string) => Money.fromDecimal(decimal, "KES");

async function setup(expiryRequired: (item: string) => boolean = () => false) {
  const clock = new FixedClock(new Date("2026-03-01T09:00:00Z"));
  const ledger = new Ledger(new InMemoryLedgerStore(), COMPANY, "KES", clock);
  await ledger.createAccount({ code: "1300", name: "Stock on hand", type: "ASSET" });
  await ledger.createAccount({ code: "2050", name: "Goods received not invoiced", type: "LIABILITY" });
  await ledger.createAccount({ code: "5000", name: "Cost of goods sold", type: "EXPENSE" });
  await ledger.createAccount({ code: "5100", name: "Expired stock written off", type: "EXPENSE" });
  await ledger.createFiscalYear(2026, 1);
  const store = new InMemoryInventoryStore();
  const inventory = new Inventory({ store, posting: { ledger, accounts: ACCOUNTS }, expiryRequired, clock });
  return { ledger, store, inventory };
}

function receive(inventory: Inventory, overrides: Partial<ReceiveInput> = {}) {
  return inventory.receive({
    companyId: COMPANY,
    warehouse: WAREHOUSE,
    item: ITEM,
    batchNo: "B1",
    expiresOn: "2026-09-30",
    qty: 100n,
    unitCost: kes("2.50"),
    date: "2026-03-01",
    reference: "GRN-1",
    ...overrides,
  });
}

async function ledgerBalance(ledger: Ledger, account: string) {
  const row = (await ledger.trialBalance("2026-12-31")).rows.find((item) => item.account === account);
  return { debit: row?.debit.toDecimal() ?? "0.00", credit: row?.credit.toDecimal() ?? "0.00" };
}

describe("receiving stock into batches", () => {
  it("creates a batch whose balance comes from its receipt, and posts the stock value", async () => {
    const { ledger, inventory } = await setup();
    const batch = await receive(inventory);

    expect(batch.balance).toBe(100n);
    expect(batch.batchNo).toBe("B1");
    expect(batch.expiresOn).toBe("2026-09-30");
    expect(await ledgerBalance(ledger, "1300")).toEqual({ debit: "250.00", credit: "0.00" });
    expect(await ledgerBalance(ledger, "2050")).toEqual({ debit: "0.00", credit: "250.00" });
  });

  it("refuses a batch without a batch number (BAT-001)", async () => {
    const { inventory } = await setup();
    await expect(receive(inventory, { batchNo: "   " })).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("refuses a receipt without a reference (INV-004)", async () => {
    const { inventory } = await setup();
    await expect(receive(inventory, { reference: "  " })).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("refuses stock that has already expired on the day it is received (BAT-004)", async () => {
    const { inventory } = await setup();
    await expect(receive(inventory, { expiresOn: "2026-02-28" })).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("requires an expiry date where the item policy says so (BAT-002)", async () => {
    const { inventory } = await setup(() => true);
    await expect(receive(inventory, { expiresOn: null })).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("returns the same batch when a receipt is retried, and refuses a retry that changes it", async () => {
    const { ledger, store, inventory } = await setup();
    const first = await receive(inventory);
    const again = await receive(inventory);

    expect(again.id).toBe(first.id);
    expect(store.movementsOf(COMPANY)).toHaveLength(1);
    expect(await ledgerBalance(ledger, "1300")).toEqual({ debit: "250.00", credit: "0.00" });
    await expect(receive(inventory, { qty: 90n })).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("accepts stock with no value without posting an empty ledger entry", async () => {
    const { ledger, inventory } = await setup();
    const batch = await receive(inventory, { unitCost: kes("0.00"), reference: "GRN-FREE" });

    expect(batch.balance).toBe(100n);
    expect(await ledger.entryByReference("GRN-FREE/RECEIPT")).toBeUndefined();
    expect(await ledgerBalance(ledger, "1300")).toEqual({ debit: "0.00", credit: "0.00" });
  });
});

describe("issuing stock first to expire (FEFO)", () => {
  it("takes from the batch that expires first, then the next, and costs each part at its own price", async () => {
    const { ledger, inventory } = await setup();
    await receive(inventory, { batchNo: "LATE", expiresOn: "2026-12-31", qty: 50n, unitCost: kes("3.00"), reference: "GRN-LATE" });
    await receive(inventory, { batchNo: "EARLY", expiresOn: "2026-06-30", qty: 30n, unitCost: kes("2.50"), reference: "GRN-EARLY" });

    const result = await inventory.issue({ companyId: COMPANY, warehouse: WAREHOUSE, item: ITEM, qty: 40n, date: "2026-03-05", reference: "ISS-1" });

    expect(result.allocations.map((a) => [a.batchNo, a.qty])).toEqual([
      ["EARLY", 30n],
      ["LATE", 10n],
    ]);
    expect(result.cost.toDecimal()).toBe("105.00");
    expect(await ledgerBalance(ledger, "5000")).toEqual({ debit: "105.00", credit: "0.00" });
    expect(await ledgerBalance(ledger, "1300")).toEqual({ debit: "225.00", credit: "105.00" });
  });

  it("never takes expired stock, so only the unexpired balance counts as available", async () => {
    const { inventory } = await setup();
    await receive(inventory, { expiresOn: "2026-03-10", qty: 20n, reference: "GRN-SHORT" });

    expect(await inventory.available(COMPANY, WAREHOUSE, ITEM, "2026-03-11")).toBe(0n);
    await expect(
      inventory.issue({ companyId: COMPANY, warehouse: WAREHOUSE, item: ITEM, qty: 5n, date: "2026-03-11", reference: "ISS-EXP" }),
    ).rejects.toMatchObject({ code: "UNPROCESSABLE" });
  });

  it("refuses to take stock below zero (INV-003), and writes nothing when refused", async () => {
    const { ledger, store, inventory } = await setup();
    await receive(inventory, { qty: 10n });

    await expect(
      inventory.issue({ companyId: COMPANY, warehouse: WAREHOUSE, item: ITEM, qty: 11n, date: "2026-03-05", reference: "ISS-BIG" }),
    ).rejects.toMatchObject({ code: "UNPROCESSABLE" });
    expect(store.movementsOf(COMPANY)).toHaveLength(1);
    expect(await ledger.entryByReference("ISS-BIG/ISSUE")).toBeUndefined();
  });

  it("does not take stock from another warehouse", async () => {
    const { inventory } = await setup();
    await receive(inventory, { warehouse: "BACK", qty: 10n });

    await expect(
      inventory.issue({ companyId: COMPANY, warehouse: WAREHOUSE, item: ITEM, qty: 1n, date: "2026-03-05", reference: "ISS-WH" }),
    ).rejects.toMatchObject({ code: "UNPROCESSABLE" });
  });

  it("a retried issue returns the first result and takes the stock once", async () => {
    const { ledger, store, inventory } = await setup();
    await receive(inventory, { qty: 100n });
    const input = { companyId: COMPANY, warehouse: WAREHOUSE, item: ITEM, qty: 10n, date: "2026-03-05", reference: "ISS-RETRY" };

    const first = await inventory.issue(input);
    const again = await inventory.issue(input);

    expect(again.allocations).toEqual(first.allocations);
    expect(again.entry?.id).toBe(first.entry?.id);
    expect(await inventory.available(COMPANY, WAREHOUSE, ITEM, "2026-03-05")).toBe(90n);
    expect(store.movementsOf(COMPANY).filter((m) => m.type === "ISSUE")).toHaveLength(1);
    expect(await ledgerBalance(ledger, "5000")).toEqual({ debit: "25.00", credit: "0.00" });
  });

  it("refuses a reused issue reference for a different quantity", async () => {
    const { inventory } = await setup();
    await receive(inventory, { qty: 100n });
    await inventory.issue({ companyId: COMPANY, warehouse: WAREHOUSE, item: ITEM, qty: 10n, date: "2026-03-05", reference: "ISS-REUSE" });

    await expect(
      inventory.issue({ companyId: COMPANY, warehouse: WAREHOUSE, item: ITEM, qty: 20n, date: "2026-03-05", reference: "ISS-REUSE" }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("two issues racing for the last units: one is served, the other is refused, and no stock goes negative", async () => {
    const { inventory } = await setup();
    await receive(inventory, { qty: 10n });

    const results = await Promise.allSettled([
      inventory.issue({ companyId: COMPANY, warehouse: WAREHOUSE, item: ITEM, qty: 6n, date: "2026-03-05", reference: "RACE-A" }),
      inventory.issue({ companyId: COMPANY, warehouse: WAREHOUSE, item: ITEM, qty: 6n, date: "2026-03-05", reference: "RACE-B" }),
    ]);

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const refused = results.find((r) => r.status === "rejected");
    expect(refused?.status === "rejected" && refused.reason).toMatchObject({ code: "UNPROCESSABLE" });
    expect(await inventory.available(COMPANY, WAREHOUSE, ITEM, "2026-03-05")).toBe(4n);
  });
});

describe("expiry: write-off and reporting", () => {
  it("writes off only the batches that have expired, at their cost", async () => {
    const { ledger, store, inventory } = await setup();
    await receive(inventory, { batchNo: "OLD", expiresOn: "2026-03-10", qty: 20n, unitCost: kes("2.00"), reference: "GRN-OLD" });
    await receive(inventory, { batchNo: "NEW", expiresOn: "2026-12-31", qty: 10n, unitCost: kes("2.00"), reference: "GRN-NEW" });

    const result = await inventory.writeOffExpired({ companyId: COMPANY, warehouse: WAREHOUSE, item: ITEM, date: "2026-03-11", reference: "WO-1" });

    expect(result?.allocations.map((a) => [a.batchNo, a.qty])).toEqual([["OLD", 20n]]);
    expect(result?.cost.toDecimal()).toBe("40.00");
    expect(await ledgerBalance(ledger, "5100")).toEqual({ debit: "40.00", credit: "0.00" });
    expect(await ledgerBalance(ledger, "1300")).toEqual({ debit: "60.00", credit: "40.00" });
    const batches = await store.batches(COMPANY);
    expect(batches.find((b) => b.batchNo === "NEW")?.balance).toBe(10n);
    expect(batches.find((b) => b.batchNo === "OLD")?.balance).toBe(0n);
  });

  it("writes off nothing when nothing has expired", async () => {
    const { inventory } = await setup();
    await receive(inventory, { qty: 10n });

    expect(await inventory.writeOffExpired({ companyId: COMPANY, warehouse: WAREHOUSE, item: ITEM, date: "2026-03-05", reference: "WO-NONE" })).toBeNull();
  });

  it("a retried write-off is not repeated", async () => {
    const { ledger, inventory } = await setup();
    await receive(inventory, { expiresOn: "2026-03-10", qty: 20n, unitCost: kes("2.00"), reference: "GRN-R" });
    const input = { companyId: COMPANY, warehouse: WAREHOUSE, item: ITEM, date: "2026-03-11", reference: "WO-RETRY" };

    await inventory.writeOffExpired(input);
    await inventory.writeOffExpired(input);

    expect(await ledgerBalance(ledger, "5100")).toEqual({ debit: "40.00", credit: "0.00" });
  });

  it("reports expired batches and those expiring within the window, with days left", async () => {
    const { inventory } = await setup();
    await receive(inventory, { batchNo: "OLD", expiresOn: "2026-03-10", qty: 20n, reference: "GRN-O" });
    await receive(inventory, { batchNo: "SOON", expiresOn: "2026-03-25", qty: 5n, reference: "GRN-S" });
    await receive(inventory, { batchNo: "FAR", expiresOn: "2027-06-30", qty: 5n, reference: "GRN-F" });

    const report = await inventory.expiryReport(COMPANY, "2026-03-15", 30);

    expect(report.expired.map((s) => [s.batch.batchNo, s.daysLeft])).toEqual([["OLD", -5]]);
    expect(report.expiringSoon.map((s) => [s.batch.batchNo, s.daysLeft])).toEqual([["SOON", 10]]);
    // 20 expired units and 5 expiring units, each at 2.50, are 50.00 and 12.50 of value at risk.
    expect(report.expiredValue?.toDecimal()).toBe("50.00");
    expect(report.expiringValue?.toDecimal()).toBe("12.50");
  });

  it("reports no value at risk when nothing is expired or expiring", async () => {
    const { inventory } = await setup();
    await receive(inventory, { expiresOn: "2027-06-30", qty: 5n, reference: "GRN-FAR-ONLY" });

    const report = await inventory.expiryReport(COMPANY, "2026-03-15", 30);
    expect(report.expiredValue).toBeNull();
    expect(report.expiringValue).toBeNull();
  });

  it("rejects a negative or fractional expiry window", async () => {
    const { inventory } = await setup();
    await expect(inventory.expiryReport(COMPANY, "2026-03-15", -1)).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(inventory.expiryReport(COMPANY, "2026-03-15", 1.5)).rejects.toMatchObject({ code: "VALIDATION" });
  });
});

describe("stock value agrees with the ledger", () => {
  it("the stock account always equals the value of the batches on hand", async () => {
    const { ledger, store, inventory } = await setup();
    await receive(inventory, { batchNo: "A", expiresOn: "2026-03-10", qty: 40n, unitCost: kes("2.50"), reference: "GRN-A" });
    await receive(inventory, { batchNo: "B", expiresOn: "2026-12-31", qty: 60n, unitCost: kes("3.10"), reference: "GRN-B" });
    await inventory.issue({ companyId: COMPANY, warehouse: WAREHOUSE, item: ITEM, qty: 25n, date: "2026-03-05", reference: "ISS-V1" });
    await inventory.writeOffExpired({ companyId: COMPANY, warehouse: WAREHOUSE, item: ITEM, date: "2026-03-11", reference: "WO-V1" });
    await inventory.issue({ companyId: COMPANY, warehouse: WAREHOUSE, item: ITEM, qty: 30n, date: "2026-03-12", reference: "ISS-V2" });

    const onHand = (await store.batches(COMPANY)).reduce(
      (sum, batch) => sum.add(Money.of(batch.unitCost.minor * batch.balance, "KES")),
      Money.zero("KES"),
    );
    const stock = (await ledger.trialBalance("2026-12-31")).rows.find((row) => row.account === "1300");
    expect(stock && stock.debit.subtract(stock.credit).equals(onHand)).toBe(true);
  });
});

describe("day counting", () => {
  it("counts whole days across a month end and a non-leap February", () => {
    expect(daysBetween("2026-02-27", "2026-03-01")).toBe(2);
    expect(daysBetween("2026-03-01", "2026-02-27")).toBe(-2);
    expect(daysBetween("2026-03-01", "2026-03-01")).toBe(0);
  });
});
