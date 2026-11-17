import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PoolClient } from "pg";
import { FixedClock, newId } from "@erp/kernel";
import { Inventory, type InventoryAccounts } from "@erp/inventory";
import { Ledger } from "@erp/ledger";
import { Money } from "@erp/money";
import { TenantService } from "@erp/tenancy";
import { PgInventoryStore, PgLedgerStore, PgTenantRepository, withTenantTransaction } from "../src";
import { startTestDatabase, type TestDatabase } from "../src/testing/embedded";

const clock = () => new FixedClock(new Date("2026-03-01T09:00:00Z"));
const kes = (decimal: string) => Money.fromDecimal(decimal, "KES");
const ACCOUNTS: InventoryAccounts = { inventory: "1300", clearing: "2050", cogs: "5000", writeOff: "5100" };
const WAREHOUSE = "MAIN";

describe("inventory in Postgres", () => {
  let db: TestDatabase;
  let tenantId: string;
  let companyId: string;

  beforeAll(async () => {
    db = await startTestDatabase();
    tenantId = newId();
    await withTenantTransaction(db.appPool, tenantId, async (tx) => {
      const tenants = new TenantService(new PgTenantRepository(tx));
      const tenant = await tenants.createTenant({ slug: "stock-co", name: "Stock Co", region: "EU" }, tenantId);
      await tenants.createCompany(tenant.id, { legalName: "Stock Co Ltd", countryCode: "KE", baseCurrency: "KES", fiscalYearStartMonth: 1 });
    });
    companyId = await withTenantTransaction(db.appPool, tenantId, async (tx) => {
      const { rows } = await tx.query<{ id: string }>("SELECT id FROM companies WHERE tenant_id = $1", [tenantId]);
      return rows[0]!.id;
    });
    await withTenantTransaction(db.appPool, tenantId, async (tx) => {
      const ledger = new Ledger(new PgLedgerStore(tx, tenantId), companyId, "KES", clock());
      await ledger.createAccount({ code: "1300", name: "Stock on hand", type: "ASSET" });
      await ledger.createAccount({ code: "2050", name: "Goods received not invoiced", type: "LIABILITY" });
      await ledger.createAccount({ code: "5000", name: "Cost of goods sold", type: "EXPENSE" });
      await ledger.createAccount({ code: "5100", name: "Expired stock written off", type: "EXPENSE" });
      await ledger.createFiscalYear(2026, 1);
    });
  }, 180_000);

  afterAll(async () => {
    await db?.stop();
  });

  /** Runs stock work in its own tenant transaction, as the API does for each request. */
  function stock<T>(work: (inventory: Inventory, tx: PoolClient) => Promise<T>): Promise<T> {
    return withTenantTransaction(db.appPool, tenantId, async (tx) => {
      const ledger = new Ledger(new PgLedgerStore(tx, tenantId), companyId, "KES", clock());
      const inventory = new Inventory({
        store: new PgInventoryStore(tx, tenantId, companyId),
        posting: { ledger, accounts: ACCOUNTS },
        clock: clock(),
      });
      return work(inventory, tx);
    });
  }

  function receive(item: string, batchNo: string, reference: string, qty: bigint, expiresOn: string | null, unitCost = kes("2.50")) {
    return stock((inventory) =>
      inventory.receive({ companyId, warehouse: WAREHOUSE, item, batchNo, expiresOn, qty, unitCost, date: "2026-03-01", reference }),
    );
  }

  it("receives batches, issues first to expire, and reads the balances back", async () => {
    const item = "T1-PARA";
    await receive(item, "LATE", "T1-GRN-LATE", 50n, "2026-12-31", kes("3.00"));
    await receive(item, "EARLY", "T1-GRN-EARLY", 30n, "2026-06-30", kes("2.50"));

    const result = await stock((inventory) =>
      inventory.issue({ companyId, warehouse: WAREHOUSE, item, qty: 40n, date: "2026-03-05", reference: "T1-ISS" }),
    );

    expect(result.allocations.map((a) => [a.batchNo, a.qty])).toEqual([
      ["EARLY", 30n],
      ["LATE", 10n],
    ]);
    expect(result.cost.toDecimal()).toBe("105.00");
    const batches = await withTenantTransaction(db.appPool, tenantId, (tx) =>
      new PgInventoryStore(tx, tenantId, companyId).batches(companyId),
    );
    expect(Object.fromEntries(batches.filter((b) => b.item === item).map((b) => [b.batchNo, b.balance]))).toEqual({
      EARLY: 0n,
      LATE: 40n,
    });
  });

  it("the database refuses a batch below zero even when the domain is bypassed (INV-003)", async () => {
    await receive("T2-GLOVE", "G", "T2-GRN", 5n, "2026-12-31");

    await expect(
      withTenantTransaction(db.appPool, tenantId, async (tx) => {
        const batches = await new PgInventoryStore(tx, tenantId, companyId).batches(companyId);
        const batch = batches.find((b) => b.item === "T2-GLOVE")!;
        await tx.query(
          `INSERT INTO inventory_movements (tenant_id, id, company_id, batch_id, movement_type, qty, movement_date, reference)
           VALUES ($1, $2, $3, $4, 'ISSUE', -6, '2026-03-05', 'T2-RAW')`,
          [tenantId, newId(), companyId, batch.id],
        );
      }),
    ).rejects.toThrow(/below zero/);
  });

  it("movements and batch definitions cannot be updated or removed (INV-001)", async () => {
    await receive("T3-MASK", "M", "T3-GRN", 3n, "2026-12-31");

    await expect(
      withTenantTransaction(db.appPool, tenantId, (tx) =>
        tx.query("UPDATE inventory_movements SET qty = qty WHERE company_id = $1", [companyId]),
      ),
    ).rejects.toThrow(/append-only/);
    await expect(
      withTenantTransaction(db.appPool, tenantId, (tx) => tx.query("DELETE FROM inventory_batches WHERE company_id = $1", [companyId])),
    ).rejects.toThrow(/append-only/);
  });

  it("a retried issue returns the first result and takes the stock once", async () => {
    const item = "T4-SYR";
    await receive(item, "S", "T4-GRN", 20n, "2026-12-31");
    const input = { companyId, warehouse: WAREHOUSE, item, qty: 5n, date: "2026-03-05", reference: "T4-ISS" };

    const first = await stock((inventory) => inventory.issue(input));
    const again = await stock((inventory) => inventory.issue(input));

    expect(again.allocations.map((a) => a.qty)).toEqual(first.allocations.map((a) => a.qty));
    expect(await stock((inventory) => inventory.available(companyId, WAREHOUSE, item, "2026-03-05"))).toBe(15n);
  });

  it("two issues racing for the last units: one is served, one is refused, and stock never goes negative", async () => {
    const item = "T5-PILL";
    await receive(item, "P", "T5-GRN", 10n, "2026-12-31");

    const results = await Promise.allSettled([
      stock((inventory) => inventory.issue({ companyId, warehouse: WAREHOUSE, item, qty: 6n, date: "2026-03-05", reference: "T5-A" })),
      stock((inventory) => inventory.issue({ companyId, warehouse: WAREHOUSE, item, qty: 6n, date: "2026-03-05", reference: "T5-B" })),
    ]);

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const refused = results.find((r) => r.status === "rejected");
    expect(refused?.status === "rejected" && refused.reason).toMatchObject({ code: "UNPROCESSABLE" });
    expect(await stock((inventory) => inventory.available(companyId, WAREHOUSE, item, "2026-03-05"))).toBe(4n);
  });

  it("reports expiring stock, then writes off what has expired at its cost", async () => {
    const item = "T6-VIT";
    await receive(item, "OLD", "T6-OLD", 20n, "2026-03-10", kes("2.00"));
    await receive(item, "NEW", "T6-NEW", 10n, "2026-12-31", kes("2.00"));

    const report = await stock((inventory) => inventory.expiryReport(companyId, "2026-03-15", 30));
    expect(report.expired.filter((s) => s.batch.item === item).map((s) => [s.batch.batchNo, s.daysLeft])).toEqual([["OLD", -5]]);

    const written = await stock((inventory) =>
      inventory.writeOffExpired({ companyId, warehouse: WAREHOUSE, item, date: "2026-03-11", reference: "T6-WO" }),
    );
    expect(written?.allocations.map((a) => [a.batchNo, a.qty])).toEqual([["OLD", 20n]]);
    expect(written?.cost.toDecimal()).toBe("40.00");

    const ledgerRows = await withTenantTransaction(db.appPool, tenantId, async (tx) => {
      const ledger = new Ledger(new PgLedgerStore(tx, tenantId), companyId, "KES", clock());
      return (await ledger.trialBalance("2026-12-31")).rows.find((row) => row.account === "5100");
    });
    expect(ledgerRows?.debit.toDecimal()).toBe("40.00");
  });
});
