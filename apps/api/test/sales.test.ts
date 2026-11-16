import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { startTestDatabase, type TestDatabase } from "@erp/db/testing";
import { buildApp } from "../src/app";

const PLATFORM_KEY = "platform-key-for-tests-only-0123456789";
const PASSWORD = "correct-horse-battery";
const SALES_PRODUCTS = ["MDM-01", "MDM-02", "MDM-03", "MDM-04", "PLT-05", "PLT-04", "FIN-01", "SAL-04"];

describe("sales invoice API", () => {
  let db: TestDatabase;
  let app: FastifyInstance;
  let companyId: string;
  let token: string;
  let otherCompanyId: string;
  let otherToken: string;
  let bareCompanyId: string;
  let bareToken: string;
  let issuedNumber: string;

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

  /** Sets up accounts and the 2026 fiscal year for a company, through the public API. */
  async function setUpLedger(auth: string, company: string): Promise<void> {
    for (const [code, name, type] of [
      ["1000", "Bank", "ASSET"],
      ["1200", "Receivables", "ASSET"],
      ["2100", "Tax payable", "LIABILITY"],
      ["4000", "Sales", "REVENUE"],
    ] as const) {
      const created = await call("POST", "/v1/ledger/accounts", auth, { companyId: company, code, name, type });
      expect(created.statusCode).toBe(201);
    }
    const year = await call("POST", "/v1/ledger/fiscal-years", auth, { companyId: company, startYear: 2026 });
    expect(year.statusCode).toBe(201);
  }

  const invoiceBody = (company: string) => ({
    companyId: company,
    customer: "Blue Hills Cafe",
    date: "2026-01-15",
    currency: "KES",
    receivableAccount: "1200",
    lines: [{ description: "Coffee beans", revenueAccount: "4000", amount: "1000.00", taxAccount: "2100", tax: "160.00" }],
  });

  beforeAll(async () => {
    db = await startTestDatabase();
    app = buildApp({ pool: db.appPool, platformKey: PLATFORM_KEY });

    const first = await bootstrap("sales-co");
    expect(first.statusCode).toBe(201);
    companyId = first.json().company.id;
    token = await login("sales-co");
    const enabled = await enable(first.json().tenant.id, SALES_PRODUCTS);
    expect(enabled.statusCode).toBe(200);
    await setUpLedger(token, companyId);

    // A second tenant that has not enabled the sales product, to check entitlements and isolation.
    const second = await bootstrap("other-co");
    expect(second.statusCode).toBe(201);
    otherCompanyId = second.json().company.id;
    otherToken = await login("other-co");
    await enable(second.json().tenant.id, SALES_PRODUCTS);
    await setUpLedger(otherToken, otherCompanyId);

    // A third tenant that has the ledger but not the sales product.
    const third = await bootstrap("bare-co");
    expect(third.statusCode).toBe(201);
    bareCompanyId = third.json().company.id;
    bareToken = await login("bare-co");
    await enable(third.json().tenant.id, ["MDM-03", "PLT-05", "FIN-01"]);
    await setUpLedger(bareToken, bareCompanyId);
  }, 240_000);

  afterAll(async () => {
    await app?.close();
    await db?.stop();
  });

  it("issues an invoice with the next number and returns its totals", async () => {
    const response = await call("POST", "/v1/sales/invoices", token, invoiceBody(companyId));
    expect(response.statusCode).toBe(201);
    const invoice = response.json();
    expect(invoice.number).toBe("INV-2026-000001");
    expect(invoice.status).toBe("OPEN");
    issuedNumber = invoice.number;
  });

  it("returns the invoice and lists it among the open ones", async () => {
    const one = await call("GET", `/v1/sales/invoices/${issuedNumber}?companyId=${companyId}`, token);
    expect(one.statusCode).toBe(200);
    expect(one.json()).toMatchObject({ number: issuedNumber, customer: "Blue Hills Cafe", status: "OPEN" });

    const open = await call("GET", `/v1/sales/invoices?companyId=${companyId}`, token);
    expect(open.json().map((invoice: { number: string }) => invoice.number)).toContain(issuedNumber);
  });

  it("refuses an overpayment and reports what is still owed", async () => {
    const response = await call("POST", `/v1/sales/invoices/${issuedNumber}/payments`, token, {
      companyId,
      date: "2026-01-20",
      amount: "1160.01",
      bankAccount: "1000",
      receivableAccount: "1200",
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.details).toMatchObject({ outstanding: "1160.00" });
  });

  it("records a payment in full and marks the invoice paid", async () => {
    const response = await call("POST", `/v1/sales/invoices/${issuedNumber}/payments`, token, {
      companyId,
      date: "2026-01-25",
      amount: "1160.00",
      bankAccount: "1000",
      receivableAccount: "1200",
    });
    expect(response.statusCode).toBe(201);
    expect(response.json().status).toBe("PAID");
  });

  it("does not show a tenant's invoices to another tenant", async () => {
    const response = await call("GET", `/v1/sales/invoices/${issuedNumber}?companyId=${otherCompanyId}`, otherToken);
    expect(response.statusCode).toBe(404);
  });

  it("refuses sales routes for a tenant that has not enabled SAL-04", async () => {
    const response = await call("POST", "/v1/sales/invoices", bareToken, invoiceBody(bareCompanyId));
    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe("NOT_LICENSED");
  });

  it("requires a signed-in user", async () => {
    const response = await call("POST", "/v1/sales/invoices", null, invoiceBody(companyId));
    expect(response.statusCode).toBe(401);
  });

  it("refuses to void an invoice that has been paid", async () => {
    const response = await call("POST", `/v1/sales/invoices/${issuedNumber}/void`, token, {
      companyId,
      date: "2026-01-26",
      receivableAccount: "1200",
    });
    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe("CONFLICT");
  });

  it("voids a fresh invoice that has no payments", async () => {
    const issued = await call("POST", "/v1/sales/invoices", token, invoiceBody(companyId));
    const number = issued.json().number as string;
    const voided = await call("POST", `/v1/sales/invoices/${number}/void`, token, {
      companyId,
      date: "2026-01-27",
      receivableAccount: "1200",
    });
    expect(voided.statusCode).toBe(200);
    expect(voided.json().status).toBe("VOID");
  });
});
