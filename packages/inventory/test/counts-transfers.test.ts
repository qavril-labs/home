import { describe, expect, it } from "vitest";
import { DomainError, FixedClock } from "@erp/kernel";
import { InMemoryLedgerStore, Ledger } from "@erp/ledger";
import { Money } from "@erp/money";
import {
  Inventory,
  InMemoryInventoryStore,
  parseCsv,
  receiptsFromCsv,
  type InventoryAccounts,
  type ReceiveInput,
} from "../src";

const COMPANY = "11111111-1111-7111-8111-111111111111";
const ACCOUNTS: InventoryAccounts = { inventory: "1300", clearing: "2050", cogs: "5000", writeOff: "5100", countVariance: "5200" };
const kes = (decimal: string) => Money.fromDecimal(decimal, "KES");

async function setup(withVarianceAccount = true) {
  const clock = new FixedClock(new Date("2026-03-01T09:00:00Z"));
  const ledger = new Ledger(new InMemoryLedgerStore(), COMPANY, "KES", clock);
  for (const [code, name, type] of [
    ["1300", "Stock on hand", "ASSET"],
    ["2050", "Goods received not invoiced", "LIABILITY"],
    ["5000", "Cost of goods sold", "EXPENSE"],
    ["5100", "Expired stock written off", "EXPENSE"],
    ["5200", "Stock count variance", "EXPENSE"],
  ] as const) {
    await ledger.createAccount({ code, name, type });
  }
  await ledger.createFiscalYear(2026, 1);
  const store = new InMemoryInventoryStore();
  const accounts = withVarianceAccount ? ACCOUNTS : { ...ACCOUNTS, countVariance: undefined };
  const inventory = new Inventory({ store, posting: { ledger, accounts }, clock });
  return { ledger, store, inventory };
}

function receive(inventory: Inventory, overrides: Partial<ReceiveInput> = {}) {
  return inventory.receive({
    companyId: COMPANY,
    warehouse: "MAIN",
    item: "PARA-500",
    batchNo: "B1",
    expiresOn: "2026-12-31",
    qty: 10n,
    unitCost: kes("2.50"),
    date: "2026-03-01",
    reference: `GRN-${Math.random().toString(36).slice(2, 10)}`,
    ...overrides,
  });
}

async function ledgerNet(ledger: Ledger, account: string): Promise<string> {
  const row = (await ledger.trialBalance("2026-12-31")).rows.find((item) => item.account === account);
  return row ? row.debit.subtract(row.credit).toDecimal() : "0.00";
}

describe("stock counts (INV-09)", () => {
  it("takes a count of every batch in the warehouse, with the expected quantities frozen", async () => {
    const { inventory } = await setup();
    await receive(inventory, { batchNo: "A", qty: 6n, reference: "C-A" });
    await receive(inventory, { batchNo: "B", qty: 4n, reference: "C-B", warehouse: "OTHER" });

    const count = await inventory.startCount({ companyId: COMPANY, warehouse: "MAIN", date: "2026-03-05" });

    expect(count.status).toBe("OPEN");
    expect(count.lines.map((line) => [line.batchNo, line.expected, line.counted])).toEqual([["A", 6n, null]]);
  });

  it("allows one open count per warehouse at a time", async () => {
    const { inventory } = await setup();
    await receive(inventory, { reference: "C-ONE" });
    await inventory.startCount({ companyId: COMPANY, warehouse: "MAIN", date: "2026-03-05" });

    await expect(inventory.startCount({ companyId: COMPANY, warehouse: "MAIN", date: "2026-03-05" })).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("refuses to submit until every batch has a counted quantity, and refuses a negative count", async () => {
    const { inventory } = await setup();
    await receive(inventory, { reference: "C-TWO", batchNo: "A" });
    await receive(inventory, { reference: "C-THREE", batchNo: "B" });
    const count = await inventory.startCount({ companyId: COMPANY, warehouse: "MAIN", date: "2026-03-05" });
    const [first] = count.lines;

    await expect(inventory.recordCount({ companyId: COMPANY, countId: count.id, batchId: first!.batchId, counted: -1n })).rejects.toMatchObject({ code: "VALIDATION" });
    await inventory.recordCount({ companyId: COMPANY, countId: count.id, batchId: first!.batchId, counted: 10n });
    await expect(inventory.submitCount(COMPANY, count.id)).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("applies the difference as adjustments, posting losses and gains to the variance account", async () => {
    const { ledger, store, inventory } = await setup();
    const short = await receive(inventory, { batchNo: "SHORT", qty: 10n, unitCost: kes("2.50"), reference: "C-SHORT" });
    const extra = await receive(inventory, { batchNo: "EXTRA", qty: 5n, unitCost: kes("3.00"), reference: "C-EXTRA" });
    const count = await inventory.startCount({ companyId: COMPANY, warehouse: "MAIN", date: "2026-03-05" });
    await inventory.recordCount({ companyId: COMPANY, countId: count.id, batchId: short.id, counted: 8n });
    await inventory.recordCount({ companyId: COMPANY, countId: count.id, batchId: extra.id, counted: 6n });
    await inventory.submitCount(COMPANY, count.id);

    const result = await inventory.applyCount(COMPANY, count.id);

    expect(result.count.status).toBe("APPLIED");
    expect(result.adjustments).toBe(2);
    // Two units lost at 2.50 is 5.00 out; one unit gained at 3.00 is 3.00 in. The net is 2.00 out.
    expect(result.netValue?.toDecimal()).toBe("-2.00");
    // Stock on hand: 25.00 + 15.00 received, less the 5.00 lost, plus the 3.00 gained.
    expect(await ledgerNet(ledger, "1300")).toBe("38.00");
    // The variance account nets to the loss less the gain.
    expect(await ledgerNet(ledger, "5200")).toBe("2.00");
    const balances = Object.fromEntries((await store.batches(COMPANY)).map((batch) => [batch.batchNo, batch.balance]));
    expect(balances).toEqual({ SHORT: 8n, EXTRA: 6n });
  });

  it("refuses to apply a count when stock has moved since it started and the books cannot cover the difference", async () => {
    const { inventory } = await setup();
    const batch = await receive(inventory, { batchNo: "MOVED", qty: 5n, reference: "C-MOVED" });
    const count = await inventory.startCount({ companyId: COMPANY, warehouse: "MAIN", date: "2026-03-05" });
    await inventory.issue({ companyId: COMPANY, warehouse: "MAIN", item: "PARA-500", qty: 4n, date: "2026-03-04", reference: "C-SALE" });
    await inventory.recordCount({ companyId: COMPANY, countId: count.id, batchId: batch.id, counted: 0n });
    await inventory.submitCount(COMPANY, count.id);

    await expect(inventory.applyCount(COMPANY, count.id)).rejects.toMatchObject({ code: "UNPROCESSABLE" });
  });

  it("needs the count-variance account to apply a count that differs", async () => {
    const { inventory } = await setup(false);
    const batch = await receive(inventory, { reference: "C-NOACCT" });
    const count = await inventory.startCount({ companyId: COMPANY, warehouse: "MAIN", date: "2026-03-05" });
    await inventory.recordCount({ companyId: COMPANY, countId: count.id, batchId: batch.id, counted: 9n });
    await inventory.submitCount(COMPANY, count.id);

    await expect(inventory.applyCount(COMPANY, count.id)).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("can be reopened after a rejected approval, and a count that is applied cannot be cancelled", async () => {
    const { inventory } = await setup();
    const batch = await receive(inventory, { reference: "C-REOPEN" });
    const count = await inventory.startCount({ companyId: COMPANY, warehouse: "MAIN", date: "2026-03-05" });
    await inventory.recordCount({ companyId: COMPANY, countId: count.id, batchId: batch.id, counted: 10n });
    await inventory.submitCount(COMPANY, count.id);

    expect((await inventory.reopenCount(COMPANY, count.id)).status).toBe("OPEN");
    await inventory.submitCount(COMPANY, count.id);
    await inventory.applyCount(COMPANY, count.id);
    await expect(inventory.cancelCount(COMPANY, count.id)).rejects.toMatchObject({ code: "CONFLICT" });
  });
});

describe("transfers between warehouses", () => {
  it("moves stock first to expire, keeping the batch number, expiry and cost, and posts nothing to the ledger", async () => {
    const { ledger, store, inventory } = await setup();
    await receive(inventory, { batchNo: "LATE", expiresOn: "2026-12-31", qty: 6n, unitCost: kes("3.00"), reference: "T-LATE" });
    await receive(inventory, { batchNo: "EARLY", expiresOn: "2026-06-30", qty: 4n, unitCost: kes("2.50"), reference: "T-EARLY" });
    const before = await ledgerNet(ledger, "1300");

    const result = await inventory.transfer({ companyId: COMPANY, fromWarehouse: "MAIN", toWarehouse: "BACK", item: "PARA-500", qty: 5n, date: "2026-03-05", reference: "TR-1" });

    expect(result.allocations.map((a) => [a.batchNo, a.qty])).toEqual([["EARLY", 4n], ["LATE", 1n]]);
    expect(await ledgerNet(ledger, "1300")).toBe(before);
    const batches = await store.batches(COMPANY);
    const arrived = batches.filter((batch) => batch.warehouse === "BACK");
    expect(arrived.map((batch) => [batch.batchNo, batch.expiresOn, batch.unitCost.toDecimal(), batch.balance])).toEqual([
      ["EARLY", "2026-06-30", "2.50", 4n],
      ["LATE", "2026-12-31", "3.00", 1n],
    ]);
    // The source batches keep their receipt order: LATE was received first and has 5 left; EARLY is now empty.
    expect(batches.filter((batch) => batch.warehouse === "MAIN").map((batch) => [batch.batchNo, batch.balance])).toEqual([
      ["LATE", 5n],
      ["EARLY", 0n],
    ]);
  });

  it("refuses a transfer to the same warehouse, and one that needs more than the unexpired stock", async () => {
    const { inventory } = await setup();
    await receive(inventory, { qty: 3n, reference: "T-SHORT" });

    await expect(inventory.transfer({ companyId: COMPANY, fromWarehouse: "MAIN", toWarehouse: "MAIN", item: "PARA-500", qty: 1n, date: "2026-03-05", reference: "TR-SAME" })).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(inventory.transfer({ companyId: COMPANY, fromWarehouse: "MAIN", toWarehouse: "BACK", item: "PARA-500", qty: 4n, date: "2026-03-05", reference: "TR-MORE" })).rejects.toMatchObject({ code: "UNPROCESSABLE" });
  });

  it("a retried transfer returns what the first attempt moved, and moves it once", async () => {
    const { inventory } = await setup();
    await receive(inventory, { qty: 10n, reference: "T-RETRY" });
    const input = { companyId: COMPANY, fromWarehouse: "MAIN", toWarehouse: "BACK", item: "PARA-500", qty: 4n, date: "2026-03-05", reference: "TR-RETRY" };

    const first = await inventory.transfer(input);
    const again = await inventory.transfer(input);

    expect(again.transferred).toBe(first.transferred);
    expect(await inventory.available(COMPANY, "MAIN", "PARA-500", "2026-03-05")).toBe(6n);
    expect(await inventory.available(COMPANY, "BACK", "PARA-500", "2026-03-05")).toBe(4n);
  });
});

describe("CSV import of receipts", () => {
  it("reads quoted fields, CRLF line endings, a byte-order mark and blank lines", () => {
    const rows = parseCsv('﻿warehouse,item,note\r\nMAIN,"Paracetamol, 500mg","say ""hi"""\r\n\r\nBACK,SOAP,\r\n');

    expect(rows).toEqual([
      ["warehouse", "item", "note"],
      ["MAIN", "Paracetamol, 500mg", 'say "hi"'],
      ["BACK", "SOAP", ""],
    ]);
  });

  it("reads receipts from a file with the required columns, and reports each bad row", () => {
    const text = [
      "warehouse,item,batch_no,expires_on,qty,unit_cost,date,reference",
      "MAIN,PARA-500,A1,2026-12-31,10,2.50,2026-03-01,IMP-1",
      "MAIN,SOAP,S1,,4,1.00,2026-03-01,IMP-2",
      "MAIN,PARA-500,A2,2026-12-31,ten,2.50,2026-03-01,IMP-3",
      "MAIN,PARA-500,A3,2026-12-31,5,2.505,2026-03-01,IMP-4",
    ].join("\n");

    const parsed = receiptsFromCsv(text, { companyId: COMPANY, currency: "KES" });

    expect(parsed.rows.map((row) => [row.batchNo, row.expiresOn, row.qty])).toEqual([
      ["A1", "2026-12-31", 10n],
      ["S1", null, 4n],
    ]);
    expect(parsed.errors.map((error) => error.row)).toEqual([3, 4]);
  });

  it("refuses a file without a required column", () => {
    expect(() => receiptsFromCsv("warehouse,item\nMAIN,SOAP\n", { companyId: COMPANY, currency: "KES" })).toThrow(DomainError);
  });
});

describe("importing receipts", () => {
  function rowsFor(references: string[]): ReceiveInput[] {
    return references.map((reference, index) => ({
      companyId: COMPANY,
      warehouse: "MAIN",
      item: "PARA-500",
      batchNo: `IMP${index}`,
      expiresOn: "2026-12-31",
      qty: 5n,
      unitCost: kes("2.00"),
      date: "2026-03-01",
      reference,
    }));
  }

  it("a dry run reports the totals and writes nothing", async () => {
    const { store, inventory } = await setup();

    const report = await inventory.importReceipts(COMPANY, rowsFor(["DRY-1", "DRY-2"]), { dryRun: true });

    expect(report).toMatchObject({ rows: 2, applied: false, totalQty: 10n });
    expect(report.totalValue?.toDecimal()).toBe("20.00");
    expect(report.errors).toEqual([]);
    expect(await store.batches(COMPANY)).toEqual([]);
  });

  it("writes every row in one go when all of them are valid, and reconciles to the ledger", async () => {
    const { ledger, store, inventory } = await setup();

    const report = await inventory.importReceipts(COMPANY, rowsFor(["IMP-A", "IMP-B"]), { dryRun: false });

    expect(report.applied).toBe(true);
    expect(await store.batches(COMPANY)).toHaveLength(2);
    expect(await ledgerNet(ledger, "1300")).toBe("20.00");
    // Importing the same file again returns the same batches and posts nothing more.
    await inventory.importReceipts(COMPANY, rowsFor(["IMP-A", "IMP-B"]), { dryRun: false });
    expect(await store.batches(COMPANY)).toHaveLength(2);
    expect(await ledgerNet(ledger, "1300")).toBe("20.00");
  });

  it("writes nothing when any row is invalid, so a bad file is never half imported", async () => {
    const { store, inventory } = await setup();
    const rows = rowsFor(["ALL-1", "ALL-2"]);
    const broken = [rows[0]!, { ...rows[1]!, batchNo: "  " }];

    const report = await inventory.importReceipts(COMPANY, broken, { dryRun: false });

    expect(report.applied).toBe(false);
    expect(report.errors.map((error) => error.row)).toEqual([2]);
    expect(await store.batches(COMPANY)).toEqual([]);
  });

  it("refuses a reference used twice in one file", async () => {
    const { inventory } = await setup();
    const rows = rowsFor(["SAME", "SAME"]);

    const report = await inventory.importReceipts(COMPANY, rows, { dryRun: true });

    expect(report.errors).toEqual([{ row: 2, message: "Reference SAME appears more than once in the file" }]);
  });
});
