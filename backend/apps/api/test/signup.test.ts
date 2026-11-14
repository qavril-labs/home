import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { startTestDatabase, type TestDatabase } from "@erp/db/testing";
import { buildApp } from "../src/app";
import { slugFromCompany } from "../src/signup";

const PLATFORM_KEY = "platform-key-for-tests-only-0123456789";
const SITE_ORIGIN = "https://site.example";

function signupPayload(overrides: Record<string, unknown> = {}) {
  return {
    name: "Grace Hopper",
    email: "Grace@Example.com ",
    password: "correct horse battery",
    company: "Corner Café & Co",
    countryCode: "ke",
    baseCurrency: "kes",
    region: "MEA",
    consent: true,
    website: "",
    ...overrides,
  };
}

describe("slugFromCompany", () => {
  it("lowercases, strips accents and joins words with single hyphens", () => {
    expect(slugFromCompany("Corner Café & Co")).toBe("corner-cafe-co");
    expect(slugFromCompany("  --ACME   Ltd.-- ")).toBe("acme-ltd");
  });

  it("pads names too short to be a workspace address", () => {
    expect(slugFromCompany("X")).toBe("workspace-x");
    expect(slugFromCompany("!!!")).toBe("workspace");
  });
});

describe("self-service sign-up", () => {
  let db: TestDatabase;
  let app: FastifyInstance;
  let limitedApp: FastifyInstance;

  beforeAll(async () => {
    db = await startTestDatabase();
    app = buildApp({
      pool: db.appPool,
      platformKey: PLATFORM_KEY,
      corsOrigins: [SITE_ORIGIN],
      signupRateLimit: { max: 50, windowMs: 600_000 },
    });
    limitedApp = buildApp({
      pool: db.appPool,
      platformKey: PLATFORM_KEY,
      corsOrigins: [SITE_ORIGIN],
      signupRateLimit: { max: 1, windowMs: 600_000 },
    });
  }, 180_000);

  afterAll(async () => {
    await app?.close();
    await limitedApp?.close();
    await db?.stop();
  });

  const signup = (instance: FastifyInstance, body: object) =>
    instance.inject({ method: "POST", url: "/v1/public/signup", headers: { origin: SITE_ORIGIN }, payload: body });

  it("creates the workspace, signs the owner in, and the session works", async () => {
    const response = await signup(app, signupPayload());
    expect(response.statusCode).toBe(201);
    expect(response.headers["access-control-allow-origin"]).toBe(SITE_ORIGIN);
    const body = response.json();
    expect(body.workspace).toBe("corner-cafe-co");
    expect(body.company.name).toBe("Corner Café & Co");
    expect(body.session.token.startsWith(`${body.tenantId}.`)).toBe(true);
    expect(body.session.principal.roles).toContain("tenant_admin");

    const me = await app.inject({ method: "GET", url: "/v1/me", headers: { authorization: `Bearer ${body.session.token}` } });
    expect(me.statusCode).toBe(200);
    expect(me.json().principal.email).toBe("grace@example.com");

    const login = await app.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: { tenantSlug: "corner-cafe-co", email: "grace@example.com", password: "correct horse battery" },
    });
    expect(login.statusCode).toBe(200);
  });

  it("gives a second business with the same name its own address", async () => {
    const response = await signup(app, signupPayload({ email: "other@example.com" }));
    expect(response.statusCode).toBe(201);
    expect(response.json().workspace).toMatch(/^corner-cafe-co-[0-9a-f]{6}$/);
  });

  it("rejects a chosen workspace address that is taken, naming the field", async () => {
    const response = await signup(app, signupPayload({ email: "third@example.com", workspace: "corner-cafe-co" }));
    expect(response.statusCode).toBe(409);
    expect(response.json().error.details.field).toBe("workspace");
  });

  it("rejects short passwords, missing consent and unknown currencies without creating anything", async () => {
    const before = await db.adminPool.query("SELECT count(*)::int AS n FROM tenants");
    expect((await signup(app, signupPayload({ password: "short" }))).statusCode).toBe(400);
    expect((await signup(app, signupPayload({ consent: false }))).statusCode).toBe(400);
    const badCurrency = await signup(app, signupPayload({ email: "x@example.com", company: "Unknown Money", baseCurrency: "ZZZ" }));
    expect(badCurrency.statusCode).toBe(400);
    const after = await db.adminPool.query("SELECT count(*)::int AS n FROM tenants");
    expect(after.rows[0].n).toBe(before.rows[0].n);
  });

  it("drops honeypot submissions", async () => {
    const response = await signup(app, signupPayload({ company: "Bot Shop", website: "http://spam.example" }));
    expect(response.statusCode).toBe(400);
    const stored = await db.adminPool.query("SELECT 1 FROM tenants WHERE slug = 'bot-shop'");
    expect(stored.rowCount).toBe(0);
  });

  it("limits sign-ups per address", async () => {
    expect((await signup(limitedApp, signupPayload({ company: "Rate One", email: "r1@example.com" }))).statusCode).toBe(201);
    expect((await signup(limitedApp, signupPayload({ company: "Rate Two", email: "r2@example.com" }))).statusCode).toBe(429);
  });

  it("answers the browser preflight for the site origin only", async () => {
    const allowed = await app.inject({ method: "OPTIONS", url: "/v1/public/signup", headers: { origin: SITE_ORIGIN } });
    expect(allowed.statusCode).toBe(204);
    expect(allowed.headers["access-control-allow-origin"]).toBe(SITE_ORIGIN);
    const other = await app.inject({ method: "OPTIONS", url: "/v1/public/signup", headers: { origin: "https://evil.example" } });
    expect(other.headers["access-control-allow-origin"]).toBeUndefined();
  });
});
