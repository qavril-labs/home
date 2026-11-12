import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { startTestDatabase, type TestDatabase } from "@erp/db/testing";
import { buildApp } from "../src/app";

const PLATFORM_KEY = "platform-key-for-tests-only-0123456789";
const PASSWORD = "correct-horse-battery";

function bootstrapPayload(slug: string) {
  return {
    tenant: { slug, name: `${slug} Ltd`, region: "MEA" },
    company: { legalName: `${slug} Ltd`, countryCode: "KE", baseCurrency: "KES", fiscalYearStartMonth: 1 },
    admin: { email: `admin@${slug}.example`, password: PASSWORD },
  };
}

describe("Phase 0 API", () => {
  let db: TestDatabase;
  let app: FastifyInstance;

  beforeAll(async () => {
    db = await startTestDatabase();
    app = buildApp({ pool: db.appPool, platformKey: PLATFORM_KEY });
  }, 180_000);

  afterAll(async () => {
    await app?.close();
    await db?.stop();
  });

  const createTenant = (slug: string) =>
    app.inject({
      method: "POST",
      url: "/v1/platform/tenants",
      headers: { "x-platform-key": PLATFORM_KEY },
      payload: bootstrapPayload(slug),
    });

  const login = (tenantSlug: string, password: string) =>
    app.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: { tenantSlug, email: `admin@${tenantSlug}.example`, password },
    });

  it("reports health", async () => {
    const response = await app.inject({ method: "GET", url: "/health" });
    expect(response.json()).toEqual({ status: "ok" });
  });

  it("refuses tenant creation without the platform key", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/v1/platform/tenants",
      payload: bootstrapPayload("no-key"),
    });
    expect(response.statusCode).toBe(403);
  });

  it("creates a tenant with its company and administrator, without leaking the password", async () => {
    const response = await createTenant("acme");
    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.tenant.slug).toBe("acme");
    expect(body.company.baseCurrency).toBe("KES");
    expect(body.admin.email).toBe("admin@acme.example");
    expect(body.admin.passwordHash).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain(PASSWORD);
  });

  it("rejects duplicate tenant slugs", async () => {
    await createTenant("dupe");
    const response = await createTenant("dupe");
    expect(response.statusCode).toBe(409);
  });

  it("logs in and resolves the administrator's permissions", async () => {
    await createTenant("login-ok");
    const session = await login("login-ok", PASSWORD);
    expect(session.statusCode).toBe(200);
    const { token } = session.json();

    const me = await app.inject({
      method: "GET",
      url: "/v1/me",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(me.statusCode).toBe(200);
    expect(me.json().principal.permissions).toEqual(["*"]);
  });

  it("returns the same error for a wrong password and an unknown tenant", async () => {
    await createTenant("errors");
    const wrongPassword = await login("errors", "definitely-wrong-password");
    const unknownTenant = await login("no-such-tenant", PASSWORD);
    expect(wrongPassword.statusCode).toBe(401);
    expect(unknownTenant.statusCode).toBe(401);
    expect(wrongPassword.json().error.message).toBe("Invalid credentials");
    expect(unknownTenant.json().error.message).toBe("Invalid credentials");
  });

  it("revokes the session on logout", async () => {
    await createTenant("logout");
    const { token } = (await login("logout", PASSWORD)).json();
    const headers = { authorization: `Bearer ${token}` };

    expect((await app.inject({ method: "POST", url: "/v1/auth/logout", headers })).statusCode).toBe(204);
    expect((await app.inject({ method: "GET", url: "/v1/me", headers })).statusCode).toBe(401);
  });

  it("refuses logins for suspended tenants", async () => {
    await createTenant("suspended");
    await db.adminPool.query("UPDATE tenants SET status = 'SUSPENDED' WHERE slug = 'suspended'");
    expect((await login("suspended", PASSWORD)).statusCode).toBe(401);
  });

  it("rejects malformed requests with a validation error", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/v1/platform/tenants",
      headers: { "x-platform-key": PLATFORM_KEY },
      payload: { tenant: "not-an-object" },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe("VALIDATION");
  });
});
