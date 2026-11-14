import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { PgIdentityRepository, withTenantTransaction } from "@erp/db";
import { startTestDatabase, type TestDatabase } from "@erp/db/testing";
import { IdentityService } from "@erp/identity";
import { buildApp } from "../src/app";

const PLATFORM_KEY = "platform-key-for-tests-only-0123456789";
const PASSWORD = "correct-horse-battery";

describe("general ledger API", () => {
  let db: TestDatabase;
  let app: FastifyInstance;
  let tenantId: string;
  let companyId: string;
  let adminToken: string;
  let firstEntryId: string;

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

  const login = async (slug: string, email: string): Promise<string> => {
    const response = await app.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: { tenantSlug: slug, email, password: PASSWORD },
    });
    return response.json().token as string;
  };

  const enable = (tenant: string, products: string[]) =>
    app.inject({
      method: "POST",
      url: `/v1/platform/tenants/${tenant}/products`,
      headers: { "x-platform-key": PLATFORM_KEY },
      payload: { products },
    });

  const call = (method: "GET" | "POST", url: string, token: string, payload?: object) =>
    app.inject({ method, url, headers: { authorization: `Bearer ${token}` }, payload });

  const sale = (reference: string, amount: string, date = "2026-01-15") => ({
    companyId,
    reference,
    date,
    currency: "KES",
    lines: [
      { account: "1000", side: "DEBIT", amount },
      { account: "4000", side: "CREDIT", amount },
    ],
  });

  beforeAll(async () => {
    db = await startTestDatabase();
    app = buildApp({ pool: db.appPool, platformKey: PLATFORM_KEY });
    const created = await bootstrap("ledger-co");
    expect(created.statusCode).toBe(201);
    tenantId = created.json().tenant.id;
    companyId = created.json().company.id;
    adminToken = await login("ledger-co", "admin@ledger-co.example");
    const enabled = await enable(tenantId, ["MDM-03", "FIN-01"]);
    expect(enabled.statusCode).toBe(200);
  }, 180_000);

  afterAll(async () => {
    await app?.close();
    await db?.stop();
  });

  it("refuses to enable a product before the products it needs", async () => {
    const other = await bootstrap("needs-first");
    const response = await enable(other.json().tenant.id, ["FIN-01"]);
    expect(response.statusCode).toBe(422);
    expect(response.json().error.details.missing).toEqual(["MDM-03"]);
  });

  it("rejects unknown product IDs", async () => {
    const response = await enable(tenantId, ["NOPE-99"]);
    expect(response.statusCode).toBe(400);
  });

  it("creates accounts and rejects a duplicate code", async () => {
    const cash = await call("POST", "/v1/ledger/accounts", adminToken, {
      companyId,
      code: "1000",
      name: "Cash",
      type: "ASSET",
    });
    expect(cash.statusCode).toBe(201);
    expect(
      (await call("POST", "/v1/ledger/accounts", adminToken, { companyId, code: "4000", name: "Sales", type: "REVENUE" }))
        .statusCode,
    ).toBe(201);
    expect(
      (await call("POST", "/v1/ledger/accounts", adminToken, { companyId, code: "1000", name: "Again", type: "ASSET" }))
        .statusCode,
    ).toBe(409);
  });

  it("creates a fiscal year that starts in the company's fiscal start month", async () => {
    const response = await call("POST", "/v1/ledger/fiscal-years", adminToken, { companyId, startYear: 2026 });
    expect(response.statusCode).toBe(201);
    const periods = response.json().periods as Array<{ id: string }>;
    expect(periods).toHaveLength(12);
    expect(periods[0]?.id).toBe("2026-01");
  });

  it("rejects an unbalanced journal entry", async () => {
    const response = await call("POST", "/v1/ledger/journal-entries", adminToken, {
      companyId,
      reference: "BAD-1",
      date: "2026-01-15",
      currency: "KES",
      lines: [
        { account: "1000", side: "DEBIT", amount: "100.00" },
        { account: "4000", side: "CREDIT", amount: "90.00" },
      ],
    });
    expect(response.statusCode).toBe(422);
    expect(response.json().error.message).toMatch(/does not balance/);
  });

  it("posts a balanced entry and reports the trial balance", async () => {
    const posted = await call("POST", "/v1/ledger/journal-entries", adminToken, sale("INV-1", "1000.00"));
    expect(posted.statusCode).toBe(201);
    firstEntryId = posted.json().id;

    const trial = await call("GET", `/v1/ledger/trial-balance?companyId=${companyId}&asOf=2026-12-31`, adminToken);
    expect(trial.statusCode).toBe(200);
    expect(trial.json().totalDebit.amount).toBe("1000.00");
    expect(trial.json().totalCredit.amount).toBe("1000.00");
  });

  it("returns the stored entry on a retry and rejects a reused reference", async () => {
    const retry = await call("POST", "/v1/ledger/journal-entries", adminToken, sale("INV-1", "1000.00"));
    expect(retry.statusCode).toBe(201);
    expect(retry.json().id).toBe(firstEntryId);

    const reused = await call("POST", "/v1/ledger/journal-entries", adminToken, sale("INV-1", "2000.00"));
    expect(reused.statusCode).toBe(409);
  });

  it("posts a foreign-currency entry at the stored rate", async () => {
    const rate = await call("POST", "/v1/ledger/fx-rates", adminToken, {
      companyId,
      base: "USD",
      quote: "KES",
      effectiveDate: "2026-01-01",
      rate: "130",
    });
    expect(rate.statusCode).toBe(201);

    const usd = await call("POST", "/v1/ledger/journal-entries", adminToken, {
      companyId,
      reference: "USD-SALE-1",
      date: "2026-01-15",
      currency: "USD",
      lines: [
        { account: "1000", side: "DEBIT", amount: "100.00" },
        { account: "4000", side: "CREDIT", amount: "100.00" },
      ],
    });
    expect(usd.statusCode).toBe(201);
    expect(usd.json().lines[0].baseAmount.amount).toBe("13000.00");

    const trial = await call("GET", `/v1/ledger/trial-balance?companyId=${companyId}&asOf=2026-12-31`, adminToken);
    expect(trial.json().totalDebit.amount).toBe("14000.00");
  });

  it("reverses an entry, keeping the books balanced, and allows only one reversal", async () => {
    const reversed = await call("POST", `/v1/ledger/journal-entries/${firstEntryId}/reverse`, adminToken, {
      companyId,
      reference: "INV-1-REV",
      date: "2026-01-20",
    });
    expect(reversed.statusCode).toBe(201);

    const trial = await call("GET", `/v1/ledger/trial-balance?companyId=${companyId}&asOf=2026-12-31`, adminToken);
    const cash = trial.json().rows.find((row: { account: string }) => row.account === "1000");
    expect(cash.debit.amount).toBe("14000.00");
    expect(cash.credit.amount).toBe("1000.00");

    const again = await call("POST", `/v1/ledger/journal-entries/${firstEntryId}/reverse`, adminToken, {
      companyId,
      reference: "INV-1-REV-2",
      date: "2026-01-21",
    });
    expect(again.statusCode).toBe(409);
  });

  it("refuses ledger access to a user without the permission", async () => {
    await withTenantTransaction(db.appPool, tenantId, (tx) =>
      new IdentityService(new PgIdentityRepository(tx), tenantId).createUser({
        email: "viewer@ledger-co.example",
        password: PASSWORD,
        roles: ["user"],
      }),
    );
    const viewerToken = await login("ledger-co", "viewer@ledger-co.example");

    const post = await call("POST", "/v1/ledger/journal-entries", viewerToken, sale("VIEW-1", "10.00"));
    expect(post.statusCode).toBe(403);
    expect(post.json().error.code).toBe("FORBIDDEN");

    const trial = await call("GET", `/v1/ledger/trial-balance?companyId=${companyId}&asOf=2026-12-31`, viewerToken);
    expect(trial.statusCode).toBe(403);
  });

  it("refuses ledger access to a tenant that has not bought FIN-01", async () => {
    const other = await bootstrap("no-ledger");
    const token = await login("no-ledger", "admin@no-ledger.example");
    const response = await call("POST", "/v1/ledger/accounts", token, {
      companyId: other.json().company.id,
      code: "1000",
      name: "Cash",
      type: "ASSET",
    });
    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe("NOT_LICENSED");
  });

  it("does not expose another tenant's company to the caller", async () => {
    const other = await bootstrap("isolated");
    await enable(other.json().tenant.id, ["MDM-03", "FIN-01"]);
    const response = await call("GET", `/v1/ledger/trial-balance?companyId=${other.json().company.id}&asOf=2026-12-31`, adminToken);
    expect(response.statusCode).toBe(404);
  });
});
