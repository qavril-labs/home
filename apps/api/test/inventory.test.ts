import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { startTestDatabase, type TestDatabase } from "@erp/db/testing";
import { buildApp } from "../src/app";

const PLATFORM_KEY = "platform-key-for-tests-only-0123456789";
const PASSWORD = "correct-horse-battery";
// The catalog chain: INV-03 needs INV-01, which needs MDM-02; FIN-01 needs MDM-03 and PLT-05.
const STOCK_PRODUCTS = ["MDM-02", "MDM-03", "PLT-05", "FIN-01", "INV-01", "INV-03"];
const ACCOUNTS = { inventory: "1300", clearing: "2050", cogs: "5000", writeOff: "5100" };

describe("inventory API (INV-01, INV-03, pharmacy expiry)", () => {
  let db: TestDatabase;
  let app: FastifyInstance;
  let companyId: string;
  let token: string;
  let plainCompanyId: string;
  let plainToken: string;

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
    const response = await app.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: { tenantSlug: slug, email: `admin@${slug}.example`, password: PASSWORD },
    });
    return response.json().token as string;
  };

  const call = (method: "GET" | "POST", url: string, auth: string | null, payload?: object) =>
    app.inject({
      method,
      url,
      headers: auth ? { authorization: `Bearer ${auth}` } : {},
      payload,
    });

  const enable = (tenant: string, products: string[]) =>
    app.inject({
      method: "POST",
      url: `/v1/platform/tenants/${tenant}/products`,
      headers: { "x-platform-key": PLATFORM_KEY },
      payload: { products },
    });

  async function setUpLedger(auth: string, company: string): Promise<void> {
    for (const [code, name, type] of [
      ["1300", "Stock on hand", "ASSET"],
      ["2050", "Goods received not invoiced", "LIABILITY"],
      ["5000", "Cost of goods sold", "EXPENSE"],
      ["5100", "Expired stock written off", "EXPENSE"],
    ] as const) {
      const created = await call("POST", "/v1/ledger/accounts", auth, { companyId: company, code, name, type });
      expect(created.statusCode).toBe(201);
    }
    const year = await call("POST", "/v1/ledger/fiscal-years", auth, { companyId: company, startYear: 2026 });
    expect(year.statusCode).toBe(201);
  }

  const receiptBody = (overrides: Record<string, unknown>) => ({
    companyId,
    warehouse: "MAIN",
    item: "PARA-500",
    batchNo: "B1",
    expiresOn: "2026-12-31",
    qty: "10",
    unitCost: "2.50",
    date: "2026-03-01",
    reference: `GRN-${Math.random().toString(36).slice(2, 10)}`,
    accounts: ACCOUNTS,
    ...overrides,
  });

  beforeAll(async () => {
    db = await startTestDatabase();
    app = buildApp({ pool: db.appPool, platformKey: PLATFORM_KEY });

    const first = await bootstrap("stock-co");
    expect(first.statusCode).toBe(201);
    companyId = first.json().company.id;
    token = await login("stock-co");
    expect((await enable(first.json().tenant.id, STOCK_PRODUCTS)).statusCode).toBe(200);
    await setUpLedger(token, companyId);

    // A tenant that has the accounting product but not the inventory products.
    const plain = await bootstrap("plain-co");
    expect(plain.statusCode).toBe(201);
    plainCompanyId = plain.json().company.id;
    plainToken = await login("plain-co");
    await enable(plain.json().tenant.id, ["MDM-03", "PLT-05", "FIN-01"]);
    await setUpLedger(plainToken, plainCompanyId);
  }, 240_000);

  afterAll(async () => {
    await app?.close();
    await db?.stop();
  });

  it("receives a batch and returns it with its balance and cost", async () => {
    const response = await call("POST", "/v1/inventory/receipts", token, receiptBody({ item: "API-LATE", batchNo: "LATE", qty: "50", unitCost: "3.00", reference: "API-GRN-LATE", expiresOn: "2026-12-31" }));
    expect(response.statusCode).toBe(201);
    const batch = response.json();
    expect(batch).toMatchObject({ batchNo: "LATE", receivedQty: "50", balance: "50", expiresOn: "2026-12-31" });
    expect(batch.unitCost).toEqual({ amount: "3.00", currency: "KES" });
  });

  it("returns the same batch for a retried receipt, and refuses a retry that changes it", async () => {
    const body = receiptBody({ item: "API-RETRY", reference: "API-GRN-RETRY", qty: "12" });
    const first = await call("POST", "/v1/inventory/receipts", token, body);
    const again = await call("POST", "/v1/inventory/receipts", token, body);
    expect(again.json().id).toBe(first.json().id);

    const changed = await call("POST", "/v1/inventory/receipts", token, { ...body, qty: "13" });
    expect(changed.statusCode).toBe(409);
  });

  it("issues the batch that expires first, and returns the cost and the ledger entry", async () => {
    const item = "API-FEFO";
    await call("POST", "/v1/inventory/receipts", token, receiptBody({ item, batchNo: "LATE", expiresOn: "2026-12-31", qty: "50", unitCost: "3.00", reference: "FEFO-LATE" }));
    await call("POST", "/v1/inventory/receipts", token, receiptBody({ item, batchNo: "EARLY", expiresOn: "2026-06-30", qty: "30", unitCost: "2.50", reference: "FEFO-EARLY" }));

    const response = await call("POST", "/v1/inventory/issues", token, {
      companyId,
      warehouse: "MAIN",
      item,
      qty: "40",
      date: "2026-03-05",
      reference: "FEFO-ISS",
      accounts: ACCOUNTS,
    });

    expect(response.statusCode).toBe(201);
    const issued = response.json();
    expect(issued.allocations.map((a: { batchNo: string; qty: string }) => [a.batchNo, a.qty])).toEqual([
      ["EARLY", "30"],
      ["LATE", "10"],
    ]);
    expect(issued.cost).toEqual({ amount: "105.00", currency: "KES" });
    expect(issued.entry).toMatchObject({ reference: "FEFO-ISS/ISSUE", date: "2026-03-05" });
  });

  it("refuses an issue that would take more than the unexpired stock", async () => {
    const response = await call("POST", "/v1/inventory/issues", token, {
      companyId,
      warehouse: "MAIN",
      item: "API-FEFO",
      qty: "100000",
      date: "2026-03-05",
      reference: "FEFO-TOO-MUCH",
      accounts: ACCOUNTS,
    });
    expect(response.statusCode).toBe(422);
  });

  it("writes off expired stock at its cost, and lists the batches afterwards", async () => {
    const item = "VIT-C";
    await call("POST", "/v1/inventory/receipts", token, receiptBody({ item, batchNo: "OLD", expiresOn: "2026-03-10", qty: "20", unitCost: "2.00", reference: "VIT-OLD" }));
    await call("POST", "/v1/inventory/receipts", token, receiptBody({ item, batchNo: "NEW", expiresOn: "2026-12-31", qty: "10", unitCost: "2.00", reference: "VIT-NEW" }));

    const written = await call("POST", "/v1/inventory/write-offs", token, {
      companyId,
      warehouse: "MAIN",
      item,
      date: "2026-03-11",
      reference: "VIT-WO",
      accounts: ACCOUNTS,
    });
    expect(written.statusCode).toBe(201);
    expect(written.json().allocations.map((a: { batchNo: string; qty: string }) => [a.batchNo, a.qty])).toEqual([["OLD", "20"]]);
    expect(written.json().cost).toEqual({ amount: "40.00", currency: "KES" });

    const batches = await call("GET", `/v1/inventory/batches?companyId=${companyId}&item=${item}`, token);
    expect(batches.statusCode).toBe(200);
    expect(Object.fromEntries(batches.json().map((b: { batchNo: string; balance: string }) => [b.batchNo, b.balance]))).toEqual({
      OLD: "0",
      NEW: "10",
    });

    const trial = await call("GET", `/v1/ledger/trial-balance?companyId=${companyId}&asOf=2026-12-31`, token);
    const writeOff = trial.json().rows.find((row: { account: string }) => row.account === "5100");
    expect(writeOff.debit).toEqual({ amount: "40.00", currency: "KES" });
  });

  it("the pharmacy expiry report lists stock already expired and stock expiring within the window", async () => {
    const item = "ZINC";
    for (const [batchNo, expiresOn, qty] of [
      ["PAST", "2026-03-10", "5"],
      ["SOON", "2026-03-25", "7"],
      ["FAR", "2027-06-30", "9"],
    ] as const) {
      const received = await call("POST", "/v1/inventory/receipts", token, receiptBody({ item, batchNo, expiresOn, qty, unitCost: "1.00", reference: `ZINC-${batchNo}` }));
      expect(received.statusCode, received.body).toBe(201);
    }

    const response = await call("GET", `/v1/inventory/expiry?companyId=${companyId}&asOf=2026-03-15&withinDays=30`, token);
    expect(response.statusCode).toBe(200);
    const report = response.json();
    expect(report.expired.filter((s: { batch: { item: string } }) => s.batch.item === item).map((s: { batch: { batchNo: string }; daysLeft: number }) => [s.batch.batchNo, s.daysLeft])).toEqual([["PAST", -5]]);
    expect(report.expiringSoon.filter((s: { batch: { item: string } }) => s.batch.item === item).map((s: { batch: { batchNo: string }; daysLeft: number }) => [s.batch.batchNo, s.daysLeft])).toEqual([["SOON", 10]]);
    // Value at risk covers every expired batch of the company, so check the shape and currency rather than the total.
    expect(report.expiredValue).toMatchObject({ currency: "KES" });
    expect(report.expiringValue).toMatchObject({ currency: "KES" });
  });

  it("rejects a bad quantity or date before any stock moves", async () => {
    const response = await call("POST", "/v1/inventory/receipts", token, receiptBody({ qty: "0" }));
    expect(response.statusCode).toBe(400);
    const badDate = await call("GET", `/v1/inventory/expiry?companyId=${companyId}&asOf=15-03-2026`, token);
    expect(badDate.statusCode).toBe(400);
  });

  it("refuses a company that has not enabled the inventory products", async () => {
    const response = await call("POST", "/v1/inventory/receipts", plainToken, { ...receiptBody({}), companyId: plainCompanyId });
    expect(response.statusCode).toBe(403);
  });

  it("refuses a request with no session", async () => {
    const response = await call("POST", "/v1/inventory/receipts", null, receiptBody({}));
    expect(response.statusCode).toBe(401);
  });
});
