import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { PgIdentityRepository, withTenantTransaction } from "@erp/db";
import { startTestDatabase, type TestDatabase } from "@erp/db/testing";
import { IdentityService } from "@erp/identity";
import type { Clock } from "@erp/kernel";
import { buildApp } from "../src/app";

const PLATFORM_KEY = "platform-key-for-tests-only-0123456789";
const clock: Clock = { now: () => new Date("2026-11-10T09:00:00Z") };
const PASSWORD = "a long permissions password";
const ANY_ID = "01900000-0000-7000-8000-0000000000ff";

interface WriteRoute {
  readonly method: "POST" | "PUT" | "PATCH" | "DELETE";
  readonly url: string;
  readonly payload?: object;
  /** Permission the route needs; the matrix below checks who has it. */
  readonly permission: string;
}

const routes: WriteRoute[] = [
  { method: "POST", url: "/v1/invoicing/invoices", payload: {}, permission: "sal.invoice.write" },
  { method: "PUT", url: `/v1/invoicing/invoices/${ANY_ID}`, payload: {}, permission: "sal.invoice.write" },
  { method: "DELETE", url: `/v1/invoicing/invoices/${ANY_ID}`, permission: "sal.invoice.write" },
  { method: "POST", url: `/v1/invoicing/invoices/${ANY_ID}/pay`, permission: "sal.invoice.write" },
  { method: "POST", url: "/v1/invoicing/reminders", payload: {}, permission: "sal.invoice.write" },
  { method: "POST", url: "/v1/invoicing/bills", payload: {}, permission: "prc.bill.write" },
  { method: "POST", url: "/v1/master-data/parties", payload: {}, permission: "mdm.party.write" },
  { method: "PUT", url: `/v1/master-data/parties/${ANY_ID}`, payload: {}, permission: "mdm.party.write" },
  { method: "DELETE", url: `/v1/master-data/parties/${ANY_ID}`, permission: "mdm.party.write" },
  { method: "POST", url: "/v1/master-data/items", payload: {}, permission: "mdm.item.write" },
  { method: "PUT", url: `/v1/master-data/items/${ANY_ID}`, payload: {}, permission: "mdm.item.write" },
  { method: "DELETE", url: `/v1/master-data/items/${ANY_ID}`, permission: "mdm.item.write" },
  { method: "POST", url: "/v1/master-data/accounts", payload: {}, permission: "fin.accounts.write" },
  { method: "PUT", url: "/v1/master-data/accounts/1000", payload: {}, permission: "fin.accounts.write" },
  { method: "POST", url: "/v1/procurement/orders", payload: {}, permission: "prc.order.write" },
  { method: "PATCH", url: `/v1/procurement/orders/${ANY_ID}/status`, payload: {}, permission: "prc.order.write" },
  { method: "POST", url: "/v1/procurement/receipts", payload: {}, permission: "prc.receipt.write" },
  { method: "POST", url: `/v1/procurement/matches/${ANY_ID}/override`, payload: {}, permission: "prc.match.override" },
];

describe("Write routes check a permission (PLT-01, PLT-21)", () => {
  let db: TestDatabase;
  let app: FastifyInstance;
  let tenantId: string;
  let slug: string;
  const tokens: Record<"admin" | "accountant" | "user", string> = { admin: "", accountant: "", user: "" };

  async function login(email: string): Promise<string> {
    const res = await app.inject({ method: "POST", url: "/v1/auth/login", payload: { tenantSlug: slug, email, password: PASSWORD } });
    expect(res.statusCode, email).toBe(200);
    return (res.json().session?.token ?? res.json().token) as string;
  }

  beforeAll(async () => {
    db = await startTestDatabase();
    app = buildApp({ pool: db.appPool, platformKey: PLATFORM_KEY, clock, signupRateLimit: { max: 50, windowMs: 600_000 } });
    const signup = await app.inject({
      method: "POST", url: "/v1/public/signup",
      payload: { name: "Perm Owner", email: "owner@perm.example", password: PASSWORD, company: "Perm Shop", countryCode: "US", baseCurrency: "USD", region: "US", consent: true },
    });
    expect(signup.statusCode).toBe(201);
    tenantId = signup.json().tenantId;
    slug = signup.json().workspace;
    tokens.admin = signup.json().session.token;
    for (const [email, role] of [["clerk@perm.example", "accountant"], ["viewer@perm.example", "user"]] as const) {
      await withTenantTransaction(db.appPool, tenantId, (tx) =>
        new IdentityService(new PgIdentityRepository(tx), tenantId).createUser({ email, password: PASSWORD, roles: [role] }),
      );
    }
    tokens.accountant = await login("clerk@perm.example");
    tokens.user = await login("viewer@perm.example");
  }, 600_000);

  afterAll(async () => {
    await app?.close();
    await db?.stop();
  });

  const call = (route: WriteRoute, token: string) =>
    app.inject({ method: route.method, url: route.url, headers: { authorization: `Bearer ${token}` }, ...(route.payload ? { payload: route.payload } : {}) });

  it.each(routes)("$method $url refuses a signed-in user without $permission", async (route) => {
    const res = await call(route, tokens.user);
    expect(res.statusCode).toBe(403);
    expect(res.json().error.message).toContain(route.permission);
  });

  it.each(routes)("$method $url is not refused for the accountant or the owner", async (route) => {
    for (const token of [tokens.accountant, tokens.admin]) {
      const res = await call(route, token);
      // The empty body or made-up id fails later (validation or not found); it must not fail on permission.
      expect(res.statusCode, `${route.method} ${route.url}`).not.toBe(403);
      expect(res.statusCode).not.toBe(401);
    }
  });

  it("still refuses the user when the route is hit without a session", async () => {
    const res = await app.inject({ method: "POST", url: "/v1/invoicing/invoices", payload: {} });
    expect(res.statusCode).toBe(401);
  });
});
