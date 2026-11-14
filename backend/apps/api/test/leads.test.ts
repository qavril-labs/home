import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { startTestDatabase, type TestDatabase } from "@erp/db/testing";
import { buildApp } from "../src/app";

const PLATFORM_KEY = "platform-key-for-tests-only-0123456789";
const SITE_ORIGIN = "https://site.example";

function leadPayload(overrides: Record<string, unknown> = {}) {
  return {
    name: "Ada Lovelace",
    email: "Ada@Example.com ",
    company: "Analytical Ltd",
    country: "Kenya",
    interest: "early_access",
    industry: "Retail or pharmacy",
    message: "We run three shops.",
    consent: true,
    website: "",
    source: "landing",
    ...overrides,
  };
}

describe("public lead intake", () => {
  let db: TestDatabase;
  let app: FastifyInstance;
  let limitedApp: FastifyInstance;

  beforeAll(async () => {
    db = await startTestDatabase();
    app = buildApp({
      pool: db.appPool,
      platformKey: PLATFORM_KEY,
      corsOrigins: [SITE_ORIGIN],
      leadRateLimit: { max: 50, windowMs: 600_000 },
    });
    limitedApp = buildApp({
      pool: db.appPool,
      platformKey: PLATFORM_KEY,
      corsOrigins: [SITE_ORIGIN],
      leadRateLimit: { max: 2, windowMs: 600_000 },
    });
  }, 180_000);

  afterAll(async () => {
    await app?.close();
    await limitedApp?.close();
    await db?.stop();
  });

  const submit = (instance: FastifyInstance, body: object, origin?: string) =>
    instance.inject({
      method: "POST",
      url: "/v1/public/leads",
      headers: origin ? { origin } : {},
      payload: body,
    });

  const storedLeads = async (email: string) => {
    const result = await db.adminPool.query<{
      name: string;
      email: string;
      company: string | null;
      interest: string;
      source: string;
    }>("SELECT name, email, company, interest, source FROM leads WHERE email = $1", [email]);
    return result.rows;
  };

  it("stores a valid lead with a normalized email", async () => {
    const response = await submit(app, leadPayload());
    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({ status: "received" });

    const rows = await storedLeads("ada@example.com");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ name: "Ada Lovelace", interest: "early_access", source: "landing" });
  });

  it("stores empty optional fields as null", async () => {
    await submit(app, leadPayload({ email: "blank.fields@example.com", company: "", country: "", message: "" }));
    const rows = await storedLeads("blank.fields@example.com");
    expect(rows[0]?.company).toBeNull();
  });

  it("answers bots with success and stores nothing when the honeypot is filled", async () => {
    const response = await submit(app, leadPayload({ email: "bot@example.com", website: "http://spam.example" }));
    expect(response.statusCode).toBe(201);
    expect(await storedLeads("bot@example.com")).toHaveLength(0);
  });

  it("rejects an invalid email", async () => {
    const response = await submit(app, leadPayload({ email: "not-an-email" }));
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe("VALIDATION");
  });

  it("requires consent", async () => {
    const response = await submit(app, leadPayload({ email: "no.consent@example.com", consent: false }));
    expect(response.statusCode).toBe(400);
    expect(await storedLeads("no.consent@example.com")).toHaveLength(0);
  });

  it("rejects an unknown interest", async () => {
    const response = await submit(app, leadPayload({ email: "bad.interest@example.com", interest: "buy-now" }));
    expect(response.statusCode).toBe(400);
  });

  it("accepts a free-trial request and a demo slot in the message", async () => {
    const response = await submit(
      app,
      leadPayload({ email: "trial.request@example.com", interest: "trial", message: "Preferred slot: Friday morning" }),
    );
    expect(response.statusCode).toBe(201);
    const rows = await db.adminPool.query<{ interest: string; message: string }>(
      "SELECT interest, message FROM leads WHERE email = $1",
      ["trial.request@example.com"],
    );
    expect(rows.rows[0]).toMatchObject({ interest: "trial", message: "Preferred slot: Friday morning" });
  });

  it("answers the browser preflight for the allowed site only", async () => {
    const allowed = await app.inject({
      method: "OPTIONS",
      url: "/v1/public/leads",
      headers: { origin: SITE_ORIGIN },
    });
    expect(allowed.statusCode).toBe(204);
    expect(allowed.headers["access-control-allow-origin"]).toBe(SITE_ORIGIN);
    expect(allowed.headers["access-control-allow-methods"]).toBe("GET, POST, OPTIONS");

    const other = await app.inject({
      method: "OPTIONS",
      url: "/v1/public/leads",
      headers: { origin: "https://evil.example" },
    });
    expect(other.statusCode).toBe(204);
    expect(other.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("sends the CORS header on the submission response for the allowed site", async () => {
    const response = await submit(app, leadPayload({ email: "cors.check@example.com" }), SITE_ORIGIN);
    expect(response.statusCode).toBe(201);
    expect(response.headers["access-control-allow-origin"]).toBe(SITE_ORIGIN);
  });

  it("records consent, the demo slot and time zone, and does not store a repeat within a day twice", async () => {
    const payload = leadPayload({ email: "structured.slot@example.com", slot: "Friday morning", timezone: "Africa/Nairobi" });
    expect((await submit(app, payload, SITE_ORIGIN)).statusCode).toBe(201);
    expect((await submit(app, payload, SITE_ORIGIN)).statusCode).toBe(201);
    const rows = await db.adminPool.query<{ consent_given: boolean; consent_at: Date | null; slot: string; timezone: string; status: string }>(
      "SELECT consent_given, consent_at, slot, timezone, status FROM leads WHERE email = $1",
      ["structured.slot@example.com"],
    );
    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0]).toMatchObject({ consent_given: true, slot: "Friday morning", timezone: "Africa/Nairobi", status: "new" });
    expect(rows.rows[0]?.consent_at).toBeInstanceOf(Date);
  });

  it("rejects a slot that is not offered", async () => {
    const response = await submit(app, leadPayload({ email: "bad.slot@example.com", slot: "Sunday night" }), SITE_ORIGIN);
    expect(response.statusCode).toBe(400);
  });

  it("does not count mistyped or honeypot submissions against the limit", async () => {
    const strict = buildApp({
      pool: db.appPool,
      platformKey: PLATFORM_KEY,
      corsOrigins: [SITE_ORIGIN],
      leadRateLimit: { max: 2, windowMs: 600_000 },
    });
    for (let i = 0; i < 3; i++) {
      expect((await submit(strict, leadPayload({ email: `typo.${i}@example.com`, consent: false }), SITE_ORIGIN)).statusCode).toBe(400);
    }
    expect((await submit(strict, leadPayload({ email: "honey.pot@example.com", website: "spam" }), SITE_ORIGIN)).statusCode).toBe(201);
    expect((await submit(strict, leadPayload({ email: "after.typos@example.com" }), SITE_ORIGIN)).statusCode).toBe(201);
    expect((await submit(strict, leadPayload({ email: "after.typos.two@example.com" }), SITE_ORIGIN)).statusCode).toBe(201);
    expect(await storedLeads("honey.pot@example.com")).toHaveLength(0);
  });

  it("limits submissions per IP and tells the browser why", async () => {
    expect((await submit(limitedApp, leadPayload({ email: "limit.one@example.com" }), SITE_ORIGIN)).statusCode).toBe(201);
    expect((await submit(limitedApp, leadPayload({ email: "limit.two@example.com" }), SITE_ORIGIN)).statusCode).toBe(201);

    const blocked = await submit(limitedApp, leadPayload({ email: "limit.three@example.com" }), SITE_ORIGIN);
    expect(blocked.statusCode).toBe(429);
    expect(blocked.json().error.code).toBe("RATE_LIMITED");
    expect(blocked.headers["access-control-allow-origin"]).toBe(SITE_ORIGIN);
    expect(await storedLeads("limit.three@example.com")).toHaveLength(0);
  });
});
