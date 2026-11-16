import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { FixedClock, newId } from "@erp/kernel";
import { Ledger } from "@erp/ledger";
import { Money } from "@erp/money";
import { NumberingService } from "@erp/numbering";
import { SALES_INVOICE_SEQUENCE, SalesInvoicing } from "@erp/sales";
import { TenantService } from "@erp/tenancy";
import { PgCounterStore, PgLedgerStore, PgInvoiceStore, PgTenantRepository, withTenantTransaction } from "../src";
import { startTestDatabase, type TestDatabase } from "../src/testing/embedded";

const clock = () => new FixedClock(new Date("2026-01-10T09:00:00Z"));
const eur = (decimal: string) => Money.fromDecimal(decimal, "EUR");

describe("sales invoices in Postgres", () => {
  let db: TestDatabase;
  let tenantId: string;

  beforeAll(async () => {
    db = await startTestDatabase();
    tenantId = newId();
    await withTenantTransaction(db.appPool, tenantId, async (tx) => {
      const tenants = new TenantService(new PgTenantRepository(tx));
      const tenant = await tenants.createTenant({ slug: "sales-co", name: "Sales Co", region: "EU" }, tenantId);
      await tenants.createCompany(tenant.id, { legalName: "Sales Co GmbH", countryCode: "DE", baseCurrency: "EUR", fiscalYearStartMonth: 1 });
    });
  }, 180_000);

  afterAll(async () => {
    await db?.stop();
  });

  async function companyId(): Promise<string> {
    return withTenantTransaction(db.appPool, tenantId, async (tx) => {
      const { rows } = await tx.query<{ id: string }>("SELECT id FROM companies WHERE tenant_id = $1", [tenantId]);
      return rows[0]!.id;
    });
  }

  it("posts the invoice, its entry and its number in one transaction, and reads it back", async () => {
    const company = await companyId();
    await withTenantTransaction(db.appPool, tenantId, async (tx) => {
      const ledger = new Ledger(new PgLedgerStore(tx, tenantId), company, "EUR", clock());
      await ledger.createAccount({ code: "1200", name: "Receivables", type: "ASSET" });
      await ledger.createAccount({ code: "1000", name: "Bank", type: "ASSET" });
      await ledger.createAccount({ code: "4000", name: "Sales", type: "REVENUE" });
      await ledger.createFiscalYear(2026, 1);
    });

    const issued = await withTenantTransaction(db.appPool, tenantId, async (tx) => {
      const ledger = new Ledger(new PgLedgerStore(tx, tenantId), company, "EUR", clock());
      const numbering = new NumberingService(new PgCounterStore(tx), [
        { key: SALES_INVOICE_SEQUENCE, prefix: "INV-", padding: 6, reset: "YEARLY" },
      ]);
      const sales = new SalesInvoicing(ledger, numbering, tenantId, "1200", new PgInvoiceStore(tx, tenantId, company));
      return sales.issue({
        customer: "Blue Hills Cafe",
        date: "2026-01-15",
        currency: "EUR",
        lines: [{ description: "Coffee", revenueAccount: "4000", amount: eur("100.00"), taxAccount: "4000", tax: eur("19.00") }],
      });
    });
    expect(issued.number).toBe("INV-2026-000001");

    const readBack = await withTenantTransaction(db.appPool, tenantId, async (tx) =>
      new PgInvoiceStore(tx, tenantId, company).get("INV-2026-000001"),
    );
    expect(readBack?.invoice).toMatchObject({ customer: "Blue Hills Cafe", status: "OPEN", date: "2026-01-15" });
    expect(readBack?.invoice.total.toDecimal()).toBe("119.00");
  });

  it("rolls back the invoice, its entry and its number together when the work fails", async () => {
    const company = await companyId();
    await expect(
      withTenantTransaction(db.appPool, tenantId, async (tx) => {
        const ledger = new Ledger(new PgLedgerStore(tx, tenantId), company, "EUR", clock());
        const numbering = new NumberingService(new PgCounterStore(tx), [
          { key: SALES_INVOICE_SEQUENCE, prefix: "INV-", padding: 6, reset: "YEARLY" },
        ]);
        const sales = new SalesInvoicing(ledger, numbering, tenantId, "1200", new PgInvoiceStore(tx, tenantId, company));
        await sales.issue({ customer: "Rolled Back Ltd", date: "2026-01-16", currency: "EUR", lines: [{ description: "Tea", revenueAccount: "4000", amount: eur("10.00") }] });
        throw new Error("simulated failure after posting");
      }),
    ).rejects.toThrow("simulated failure");

    const found = await withTenantTransaction(db.appPool, tenantId, async (tx) =>
      tx.query<{ n: string }>("SELECT count(*)::text AS n FROM sales_invoices WHERE customer = 'Rolled Back Ltd'"),
    );
    expect(found.rows[0]?.n).toBe("0");
  });
});
