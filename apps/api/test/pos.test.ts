import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { newId } from "@erp/kernel";
import { startTestDatabase, type TestDatabase } from "@erp/db/testing";
import { buildApp } from "../src/app";

const PLATFORM_KEY = "platform-key-for-tests-only-0123456789";
const PASSWORD = "correct-horse-battery";
// The catalog chain for POS-01: INV-01 and MDM-04 need MDM-02; FIN-05 needs PLT-06 and PLT-15; FIN-01 needs MDM-03 and PLT-05.
const POS_PRODUCTS = ["MDM-02", "MDM-03", "MDM-04", "PLT-05", "PLT-06", "PLT-15", "FIN-01", "FIN-05", "INV-01", "INV-03", "POS-01"];
const ACCOUNTS = {
  cash: "1000",
  card: "1010",
  mobile: "1020",
  taxPayable: "2100",
  inventory: "1300",
  clearing: "2050",
  cogs: "5000",
  writeOff: "5100",
};

describe("point-of-sale API (POS-01, offline sync)", () => {
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
    app.inject({ method, url, headers: auth ? { authorization: `Bearer ${auth}` } : {}, payload });

  const enable = (tenant: string, products: string[]) =>
    app.inject({
      method: "POST",
      url: `/v1/platform/tenants/${tenant}/products`,
      headers: { "x-platform-key": PLATFORM_KEY },
      payload: { products },
    });

  async function setUpLedger(auth: string, company: string): Promise<void> {
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
      const created = await call("POST", "/v1/ledger/accounts", auth, { companyId: company, code, name, type });
      expect(created.statusCode).toBe(201);
    }
    const year = await call("POST", "/v1/ledger/fiscal-years", auth, { companyId: company, startYear: 2026 });
    expect(year.statusCode).toBe(201);
  }

  const sale = (overrides: Record<string, unknown> = {}) => ({
    id: newId(),
    warehouse: "COUNTER",
    date: "2026-03-05",
    currency: "KES",
    lines: [
      { itemCode: "PARA-500", description: "Paracetamol 500mg", qty: "2", unitPrice: "10.00", taxRateBps: "1900", taxMode: "EXCLUSIVE", revenueAccount: "4000", tracked: true },
    ],
    tenders: [{ method: "CASH", amount: "23.80" }],
    ...overrides,
  });

  beforeAll(async () => {
    db = await startTestDatabase();
    app = buildApp({ pool: db.appPool, platformKey: PLATFORM_KEY });

    const first = await bootstrap("shop-api");
    expect(first.statusCode).toBe(201);
    companyId = first.json().company.id;
    token = await login("shop-api");
    const enabled = await enable(first.json().tenant.id, POS_PRODUCTS);
    expect(enabled.statusCode, enabled.body).toBe(200);
    await setUpLedger(token, companyId);

    const received = await call("POST", "/v1/inventory/receipts", token, {
      companyId,
      warehouse: "COUNTER",
      item: "PARA-500",
      batchNo: "A",
      expiresOn: "2026-12-31",
      qty: "20",
      unitCost: "2.50",
      date: "2026-03-01",
      reference: "POS-API-GRN",
      accounts: { inventory: "1300", clearing: "2050", cogs: "5000", writeOff: "5100" },
    });
    expect(received.statusCode, received.body).toBe(201);

    // A tenant that has the accounting product only, to check the POS product is required.
    const plain = await bootstrap("plain-shop");
    expect(plain.statusCode).toBe(201);
    plainCompanyId = plain.json().company.id;
    plainToken = await login("plain-shop");
    await enable(plain.json().tenant.id, ["MDM-03", "PLT-05", "FIN-01"]);
    await setUpLedger(plainToken, plainCompanyId);
  }, 240_000);

  afterAll(async () => {
    await app?.close();
    await db?.stop();
  });

  it("syncs a batch: posts good sales, keeps the rest for review, and rejects what is malformed", async () => {
    const good = sale();
    const repeat = { ...good };
    const shortPayment = sale({ tenders: [{ method: "CARD", amount: "5.00" }] });
    const noStock = sale({ lines: [{ itemCode: "PARA-500", description: "Paracetamol", qty: "100", unitPrice: "10.00", taxRateBps: "1900", taxMode: "EXCLUSIVE", revenueAccount: "4000", tracked: true }], tenders: [{ method: "CASH", amount: "1190.00" }] });
    const malformed = sale({ lines: [{ itemCode: "PARA-500", description: "Paracetamol", qty: "0", unitPrice: "10.00", taxRateBps: "1900", taxMode: "EXCLUSIVE", revenueAccount: "4000", tracked: true }] });
    const wrongCurrency = sale({ currency: "USD" });

    const response = await call("POST", "/v1/pos/sales/sync", token, {
      companyId,
      accounts: ACCOUNTS,
      sales: [good, repeat, shortPayment, noStock, malformed, wrongCurrency],
    });

    expect(response.statusCode, response.body).toBe(200);
    const [first, second, review, stock, bad, currency] = response.json().results;
    expect(first).toMatchObject({ id: good.id, status: "POSTED", duplicate: false, number: "POS-2026-000001" });
    expect(second).toMatchObject({ id: good.id, status: "POSTED", duplicate: true, number: "POS-2026-000001" });
    expect(review).toMatchObject({ id: shortPayment.id, status: "NEEDS_REVIEW", number: null });
    expect(review.reasons).toEqual(["PAYMENT_SHORT"]);
    expect(stock).toMatchObject({ id: noStock.id, status: "NEEDS_REVIEW", number: null });
    expect(stock.reasons[0]).toMatch(/^STOCK_SHORT/);
    expect(bad).toMatchObject({ status: "REJECTED", duplicate: false });
    expect(bad.reasons[0]).toMatch(/^VALIDATION/);
    expect(currency).toMatchObject({ id: wrongCurrency.id, status: "REJECTED" });
  });

  it("the sales waiting for review are listed for reconciliation", async () => {
    const response = await call("GET", `/v1/pos/sales?companyId=${companyId}&status=NEEDS_REVIEW`, token);
    expect(response.statusCode).toBe(200);
    const reasons = response.json().map((item: { reasons: string[] }) => item.reasons[0]);
    expect(reasons.some((reason: string) => reason === "PAYMENT_SHORT")).toBe(true);
    expect(reasons.some((reason: string) => reason.startsWith("STOCK_SHORT"))).toBe(true);
  });

  it("only the posted sale took stock, and only once despite the repeat", async () => {
    const batches = await call("GET", `/v1/inventory/batches?companyId=${companyId}&item=PARA-500`, token);
    expect(batches.statusCode).toBe(200);
    const balance = batches.json().find((batch: { batchNo: string }) => batch.batchNo === "A")?.balance;
    expect(balance).toBe("18");
  });

  it("the posted sale is in the ledger: cash received, revenue and tax recognised", async () => {
    const trial = await call("GET", `/v1/ledger/trial-balance?companyId=${companyId}&asOf=2026-12-31`, token);
    expect(trial.statusCode).toBe(200);
    const rows = Object.fromEntries(trial.json().rows.map((row: { account: string; debit: { amount: string }; credit: { amount: string } }) => [row.account, row]));
    expect(rows["1000"].debit).toEqual({ amount: "23.80", currency: "KES" });
    expect(rows["4000"].credit).toEqual({ amount: "20.00", currency: "KES" });
    expect(rows["2100"].credit).toEqual({ amount: "3.80", currency: "KES" });
    expect(rows["5000"].debit).toEqual({ amount: "5.00", currency: "KES" });
  });

  it("a company without the POS product is refused", async () => {
    const response = await call("POST", "/v1/pos/sales/sync", plainToken, { companyId: plainCompanyId, accounts: ACCOUNTS, sales: [sale()] });
    expect(response.statusCode).toBe(403);
  });

  it("a request with no session is refused", async () => {
    const response = await call("POST", "/v1/pos/sales/sync", null, { companyId, accounts: ACCOUNTS, sales: [sale()] });
    expect(response.statusCode).toBe(401);
  });
});
