import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { TenantService } from "@erp/tenancy";
import { startTestDatabase, type TestDatabase } from "@erp/db/testing";
import { PgTenantRepository, withTenantTransaction } from "@erp/db";
import { buildApp } from "../src/app";

const PLATFORM_KEY = "platform-key-for-tests-only-0123456789";
const PASSWORD = "correct-horse-battery";
const PRODUCTS = ["MDM-02", "MDM-03", "MDM-04", "PLT-05", "PLT-06", "PLT-15", "FIN-01", "FIN-05", "INV-01", "INV-03", "POS-01"];
const ACCOUNTS = { inventory: "1300", clearing: "2050", cogs: "5000", writeOff: "5100" };

describe("support for the frontend: company list and price preview", () => {
  let db: TestDatabase;
  let app: FastifyInstance;
  let tenantId: string;
  let companyId: string;
  let token: string;
  let otherToken: string;
  let otherCompanyId: string;

  const call = (method: "GET" | "POST", url: string, auth: string | null, payload?: object) =>
    app.inject({ method, url, headers: auth ? { authorization: `Bearer ${auth}` } : {}, payload });

  const bootstrap = (slug: string) =>
    app.inject({
      method: "POST",
      url: "/v1/platform/tenants",
      headers: { "x-platform-key": PLATFORM_KEY },
      payload: {
        tenant: { slug, name: `${slug} Ltd`, region: "MEA" },
        company: { legalName: `${slug} Ltd`, countryCode: "KE", baseCurrency: "KES", fiscalYearStartMonth: 1 },
        admin: { email: `admin@${slug}.example`, password: PASSWORD },
      },
    });

  const login = async (slug: string): Promise<string> => {
    const response = await app.inject({ method: "POST", url: "/v1/auth/login", payload: { tenantSlug: slug, email: `admin@${slug}.example`, password: PASSWORD } });
    return response.json().token as string;
  };

  beforeAll(async () => {
    db = await startTestDatabase();
    app = buildApp({ pool: db.appPool, platformKey: PLATFORM_KEY });

    const first = await bootstrap("front-co");
    expect(first.statusCode).toBe(201);
    tenantId = first.json().tenant.id;
    companyId = first.json().company.id;
    token = await login("front-co");
    expect((await app.inject({ method: "POST", url: `/v1/platform/tenants/${tenantId}/products`, headers: { "x-platform-key": PLATFORM_KEY }, payload: { products: PRODUCTS } })).statusCode).toBe(200);

    // A second company in the same tenant, so the list has more than one row.
    await withTenantTransaction(db.appPool, tenantId, (tx) =>
      new TenantService(new PgTenantRepository(tx)).createCompany(tenantId, { legalName: "Front Co Branch Ltd", countryCode: "KE", baseCurrency: "KES", fiscalYearStartMonth: 1 }),
    );

    const other = await bootstrap("other-front");
    expect(other.statusCode).toBe(201);
    otherCompanyId = other.json().company.id;
    otherToken = await login("other-front");

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
      expect((await call("POST", "/v1/ledger/accounts", token, { companyId, code, name, type })).statusCode).toBe(201);
    }
    expect((await call("POST", "/v1/ledger/fiscal-years", token, { companyId, startYear: 2026 })).statusCode).toBe(201);
    const received = await call("POST", "/v1/inventory/receipts", token, {
      companyId,
      warehouse: "COUNTER",
      item: "PARA-500",
      batchNo: "P",
      expiresOn: "2026-12-31",
      qty: "10",
      unitCost: "2.50",
      date: "2026-03-01",
      reference: "PREVIEW-GRN",
      accounts: ACCOUNTS,
    });
    expect(received.statusCode, received.body).toBe(201);
  }, 240_000);

  afterAll(async () => {
    await app?.close();
    await db?.stop();
  });

  it("lists only the signed-in tenant's companies", async () => {
    const mine = await call("GET", "/v1/companies", token);
    expect(mine.statusCode).toBe(200);
    const ids = mine.json().companies.map((company: { id: string }) => company.id);
    expect(ids).toEqual(expect.arrayContaining([companyId]));
    expect(ids).toHaveLength(2);
    expect(ids).not.toContain(otherCompanyId);

    const theirs = await call("GET", "/v1/companies", otherToken);
    expect(theirs.json().companies.map((company: { id: string }) => company.id)).toEqual([otherCompanyId]);
  });

  it("refuses the company list without a session", async () => {
    expect((await call("GET", "/v1/companies", null)).statusCode).toBe(401);
  });

  it("prices a sale in progress: totals, change, and the problems that would send it to review", async () => {
    const line = { itemCode: "PARA-500", description: "Paracetamol", qty: "2", unitPrice: "10.00", taxRateBps: "1900", taxMode: "EXCLUSIVE", revenueAccount: "4000", tracked: true };
    const base = { companyId, warehouse: "COUNTER", date: "2026-03-05", currency: "KES", lines: [line] };

    const exact = await call("POST", "/v1/pos/sales/price", token, { ...base, tenders: [{ method: "CASH", amount: "30.00" }] });
    expect(exact.statusCode, exact.body).toBe(200);
    expect(exact.json()).toMatchObject({
      subtotal: { amount: "20.00", currency: "KES" },
      tax: { amount: "3.80", currency: "KES" },
      total: { amount: "23.80", currency: "KES" },
      change: { amount: "6.20", currency: "KES" },
      problems: [],
    });

    const short = await call("POST", "/v1/pos/sales/price", token, { ...base, tenders: [{ method: "CARD", amount: "20.00" }] });
    expect(short.json().problems).toEqual(["PAYMENT_SHORT"]);
    expect(short.json().change).toEqual({ amount: "0.00", currency: "KES" });

    const notEntered = await call("POST", "/v1/pos/sales/price", token, { ...base, tenders: [] });
    expect(notEntered.json().problems).toEqual(["PAYMENT_MISSING"]);

    const tooMany = await call("POST", "/v1/pos/sales/price", token, { ...base, lines: [{ ...line, qty: "50" }], tenders: [{ method: "CASH", amount: "999.00" }] });
    expect(tooMany.json().problems.some((problem: string) => problem.startsWith("STOCK_SHORT: PARA-500"))).toBe(true);

    const closed = await call("POST", "/v1/pos/sales/price", token, { ...base, date: "2025-06-10", tenders: [{ method: "CASH", amount: "30.00" }] });
    expect(closed.json().problems.some((problem: string) => problem.startsWith("PERIOD_CLOSED"))).toBe(true);
  });

  it("a price preview writes nothing: no sale is stored and no stock moves", async () => {
    const sales = await call("GET", `/v1/pos/sales?companyId=${companyId}`, token);
    expect(sales.json()).toEqual([]);
    const batches = await call("GET", `/v1/inventory/batches?companyId=${companyId}&item=PARA-500&warehouse=COUNTER`, token);
    expect(batches.json()[0].balance).toBe("10");
  });
});
