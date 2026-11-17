import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { FixedClock, newId } from "@erp/kernel";
import { Inventory, type InventoryAccounts } from "@erp/inventory";
import { Ledger } from "@erp/ledger";
import { Money } from "@erp/money";
import { NumberingService } from "@erp/numbering";
import { POS_SALE_SEQUENCE, PosRegister, type SaleInput } from "@erp/pos";
import { TenantService } from "@erp/tenancy";
import { PgCounterStore, PgInventoryStore, PgLedgerStore, PgPosStore, PgTenantRepository, withTenantTransaction } from "../src";
import { startTestDatabase, type TestDatabase } from "../src/testing/embedded";

const clock = () => new FixedClock(new Date("2026-03-01T09:00:00Z"));
const kes = (decimal: string) => Money.fromDecimal(decimal, "KES");
const STOCK: InventoryAccounts = { inventory: "1300", clearing: "2050", cogs: "5000", writeOff: "5100" };
const WAREHOUSE = "COUNTER";

describe("point-of-sale sales in Postgres", () => {
  let db: TestDatabase;
  let tenantId: string;
  let companyId: string;

  beforeAll(async () => {
    db = await startTestDatabase();
    tenantId = newId();
    await withTenantTransaction(db.appPool, tenantId, async (tx) => {
      const tenants = new TenantService(new PgTenantRepository(tx));
      const tenant = await tenants.createTenant({ slug: "shop-co", name: "Shop Co", region: "EU" }, tenantId);
      await tenants.createCompany(tenant.id, { legalName: "Shop Co Ltd", countryCode: "KE", baseCurrency: "KES", fiscalYearStartMonth: 1 });
    });
    companyId = await withTenantTransaction(db.appPool, tenantId, async (tx) => {
      const { rows } = await tx.query<{ id: string }>("SELECT id FROM companies WHERE tenant_id = $1", [tenantId]);
      return rows[0]!.id;
    });
    await withTenantTransaction(db.appPool, tenantId, async (tx) => {
      const ledger = new Ledger(new PgLedgerStore(tx, tenantId), companyId, "KES", clock());
      for (const [code, name, type] of [
        ["1000", "Cash", "ASSET"],
        ["1010", "Card clearing", "ASSET"],
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
    });
    await withTenantTransaction(db.appPool, tenantId, async (tx) => {
      const ledger = new Ledger(new PgLedgerStore(tx, tenantId), companyId, "KES", clock());
      const inventory = new Inventory({ store: new PgInventoryStore(tx, tenantId, companyId), posting: { ledger, accounts: STOCK }, clock: clock() });
      await inventory.receive({ companyId, warehouse: WAREHOUSE, item: "PARA-500", batchNo: "A", expiresOn: "2026-12-31", qty: 20n, unitCost: kes("2.50"), date: "2026-03-01", reference: "POS-DB-GRN" });
    });
  }, 180_000);

  afterAll(async () => {
    await db?.stop();
  });

  /** Runs one sale in its own tenant transaction, the way the sync endpoint does. */
  function sell(input: SaleInput) {
    return withTenantTransaction(db.appPool, tenantId, async (tx) => {
      const ledger = new Ledger(new PgLedgerStore(tx, tenantId), companyId, "KES", clock());
      const register = new PosRegister({
        tenantId,
        store: new PgPosStore(tx, tenantId),
        inventory: new Inventory({ store: new PgInventoryStore(tx, tenantId, companyId), posting: { ledger, accounts: STOCK }, clock: clock() }),
        ledger,
        numbering: new NumberingService(new PgCounterStore(tx), [{ key: POS_SALE_SEQUENCE, prefix: "POS-", padding: 6, reset: "YEARLY" }]),
        accounts: { tenders: { CASH: "1000", CARD: "1010", MOBILE: "1010" }, taxPayable: "2100" },
        clock: clock(),
      });
      return register.record(input);
    });
  }

  const saleFor = (overrides: Partial<SaleInput> = {}): SaleInput => ({
    id: newId(),
    companyId,
    warehouse: WAREHOUSE,
    date: "2026-03-05",
    currency: "KES",
    lines: [
      { itemCode: "PARA-500", description: "Paracetamol 500mg", qty: 2n, unitPrice: kes("10.00"), taxRateBps: 1900n, taxMode: "EXCLUSIVE", revenueAccount: "4000", tracked: true },
    ],
    tenders: [{ method: "CASH", amount: kes("23.80") }],
    ...overrides,
  });

  it("stores a posted sale and reads it back with its lines, tenders and totals", async () => {
    const input = saleFor();
    const recorded = await sell(input);
    expect(recorded.sale).toMatchObject({ status: "POSTED", number: "POS-2026-000001" });

    const stored = await withTenantTransaction(db.appPool, tenantId, (tx) => new PgPosStore(tx, tenantId).find(companyId, input.id));
    expect(stored).toMatchObject({ id: input.id, status: "POSTED", number: "POS-2026-000001", warehouse: WAREHOUSE, date: "2026-03-05", currency: "KES" });
    expect(stored?.total.toDecimal()).toBe("23.80");
    expect(stored?.tax.toDecimal()).toBe("3.80");
    expect(stored?.cost?.toDecimal()).toBe("5.00");
    expect(stored?.lines[0]).toMatchObject({ itemCode: "PARA-500", taxRateBps: 1900n, taxMode: "EXCLUSIVE", tracked: true });
    expect(stored?.lines[0]?.qty).toBe(2n);
    expect(stored?.tenders[0]).toMatchObject({ method: "CASH" });
    expect(stored?.tenders[0]?.amount.toDecimal()).toBe("23.80");
  });

  it("a sale synced a second time returns the stored sale and is stored once", async () => {
    const input = saleFor();
    const first = await sell(input);
    const again = await sell(input);

    expect(again.duplicate).toBe(true);
    expect(again.sale.number).toBe(first.sale.number);
    const all = await withTenantTransaction(db.appPool, tenantId, (tx) => new PgPosStore(tx, tenantId).list(companyId));
    expect(all.filter((sale) => sale.id === input.id)).toHaveLength(1);
  });

  it("keeps a sale that cannot be posted for review, and lists it by status", async () => {
    const short = saleFor({ tenders: [{ method: "CARD", amount: kes("1.00") }] });
    const result = await sell(short);
    expect(result.sale).toMatchObject({ status: "NEEDS_REVIEW", number: null, reasons: ["PAYMENT_SHORT"] });

    const waiting = await withTenantTransaction(db.appPool, tenantId, (tx) => new PgPosStore(tx, tenantId).list(companyId, "NEEDS_REVIEW"));
    expect(waiting.map((sale) => sale.id)).toContain(short.id);
    expect(waiting.every((sale) => sale.status === "NEEDS_REVIEW")).toBe(true);
  });

  it("another tenant sees none of these sales, because row-level security limits the table", async () => {
    const otherTenant = newId();
    await withTenantTransaction(db.appPool, otherTenant, async (tx) => {
      const tenants = new TenantService(new PgTenantRepository(tx));
      await tenants.createTenant({ slug: "other-shop", name: "Other Shop", region: "EU" }, otherTenant);
    });
    const seen = await withTenantTransaction(db.appPool, otherTenant, (tx) => tx.query<{ n: string }>("SELECT count(*)::text AS n FROM pos_sales"));
    expect(seen.rows[0]?.n).toBe("0");
  });

  it("the table refuses to change a stored sale", async () => {
    const input = saleFor();
    await sell(input);
    await expect(
      withTenantTransaction(db.appPool, tenantId, (tx) => tx.query("UPDATE pos_sales SET status = 'NEEDS_REVIEW' WHERE id = $1", [input.id])),
    ).rejects.toThrow(/append-only/);
  });
});
