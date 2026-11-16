import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { startTestDatabase, type TestDatabase } from "@erp/db/testing";
import { buildApp } from "../src/app";

const PLATFORM_KEY = "platform-key-for-tests-only-0123456789";
const PASSWORD = "correct-horse-battery";

describe("party and item API", () => {
  let db: TestDatabase;
  let app: FastifyInstance;
  let companyId: string;
  let token: string;
  let otherCompanyId: string;
  let otherToken: string;
  let partyId: string;

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

  const enable = (tenant: string, products: string[]) =>
    app.inject({
      method: "POST",
      url: `/v1/platform/tenants/${tenant}/products`,
      headers: { "x-platform-key": PLATFORM_KEY },
      payload: { products },
    });

  const call = (method: "GET" | "POST", url: string, auth: string | null, payload?: object) =>
    app.inject({ method, url, headers: auth ? { authorization: `Bearer ${auth}` } : {}, payload });

  beforeAll(async () => {
    db = await startTestDatabase();
    app = buildApp({ pool: db.appPool, platformKey: PLATFORM_KEY });

    const first = await bootstrap("md-co");
    expect(first.statusCode).toBe(201);
    companyId = first.json().company.id;
    token = await login("md-co");
    expect((await enable(first.json().tenant.id, ["MDM-01", "MDM-02"])).statusCode).toBe(200);

    const second = await bootstrap("md-other");
    expect(second.statusCode).toBe(201);
    otherCompanyId = second.json().company.id;
    otherToken = await login("md-other");
    expect((await enable(second.json().tenant.id, ["MDM-01", "MDM-02"])).statusCode).toBe(200);
  }, 240_000);

  afterAll(async () => {
    await app?.close();
    await db?.stop();
  });

  it("creates a customer and lists it for its own company", async () => {
    const created = await call("POST", "/v1/master/parties", token, { companyId, kind: "CUSTOMER", name: "Blue Hills Cafe", taxId: "P-0001" });
    expect(created.statusCode).toBe(201);
    partyId = created.json().id;

    const mine = await call("GET", `/v1/master/parties?companyId=${companyId}`, token);
    expect(mine.statusCode).toBe(200);
    expect(mine.json().map((party: { id: string }) => party.id)).toContain(partyId);
  });

  it("does not show one tenant's parties to another tenant", async () => {
    const theirs = await call("GET", `/v1/master/parties?companyId=${companyId}`, otherToken);
    expect(theirs.statusCode).toBe(404);
    const theirList = await call("GET", `/v1/master/parties?companyId=${otherCompanyId}`, otherToken);
    expect(theirList.json().map((party: { id: string }) => party.id)).not.toContain(partyId);
  });

  it("refuses a second party with the same tax ID", async () => {
    const response = await call("POST", "/v1/master/parties", token, { companyId, kind: "SUPPLIER", name: "Duplicate", taxId: "P-0001" });
    expect(response.statusCode).toBe(409);
  });

  it("refuses an invalid email with a validation error", async () => {
    const response = await call("POST", "/v1/master/parties", token, { companyId, kind: "CUSTOMER", name: "Bad mail", email: "nope" });
    expect(response.statusCode).toBe(400);
  });

  it("deactivates a party", async () => {
    const response = await call("POST", `/v1/master/parties/${partyId}/deactivate`, token, { companyId });
    expect(response.statusCode).toBe(200);
    expect(response.json().active).toBe(false);
  });

  it("creates an item, normalises its code and refuses a duplicate", async () => {
    const created = await call("POST", "/v1/master/items", token, { companyId, code: "milk-1l", name: "Milk 1 L", unit: "EA", revenueAccount: "4000" });
    expect(created.statusCode).toBe(201);
    expect(created.json().code).toBe("MILK-1L");
    const again = await call("POST", "/v1/master/items", token, { companyId, code: "MILK-1L", name: "Milk again", unit: "EA" });
    expect(again.statusCode).toBe(409);
  });

  it("requires a signed-in user", async () => {
    const response = await call("POST", "/v1/master/parties", null, { companyId, kind: "CUSTOMER", name: "Anon" });
    expect(response.statusCode).toBe(401);
  });
});
