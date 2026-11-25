import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { startTestDatabase, type TestDatabase } from "@erp/db/testing";
import type { Clock } from "@erp/kernel";
import { buildApp } from "../src/app";

const PLATFORM_KEY = "platform-key-for-tests-only-0123456789";
const clock: Clock = { now: () => new Date("2026-11-23T09:00:00Z") };
const CONSENTED = "11111111-1111-4111-8111-111111111111";
const NO_CONSENT = "22222222-2222-4222-8222-222222222222";

describe("Platform leads and follow-up drafts (B8)", () => {
  let db: TestDatabase;
  let signupApp: FastifyInstance;
  let app: FastifyInstance;
  let unconfiguredApp: FastifyInstance;
  let platformToken: string;
  let otherToken: string;

  const auth = (t: string) => ({ authorization: `Bearer ${t}` });
  const tenantOf = (token: string) => token.split(".")[0]!;

  async function signup(email: string, company: string): Promise<string> {
    const res = await signupApp.inject({
      method: "POST",
      url: "/v1/public/signup",
      payload: { name: "Owner", email, password: "a long platform leads password", company, countryCode: "US", baseCurrency: "USD", region: "US", consent: true },
    });
    expect(res.statusCode).toBe(201);
    return res.json().session.token as string;
  }

  beforeAll(async () => {
    db = await startTestDatabase();
    signupApp = buildApp({ pool: db.appPool, platformKey: PLATFORM_KEY, clock, signupRateLimit: { max: 50, windowMs: 600_000 } });
    platformToken = await signup("ops@platform.example", "Platform Workspace");
    otherToken = await signup("owner@customer.example", "Customer Shop");
    app = buildApp({ pool: db.appPool, platformKey: PLATFORM_KEY, clock, platformTenantId: tenantOf(platformToken) });
    unconfiguredApp = buildApp({ pool: db.appPool, platformKey: PLATFORM_KEY, clock });
    await db.adminPool.query(
      `INSERT INTO leads (id, name, email, interest, source, created_at, consent_given, consent_at) VALUES
         ($1, 'Ada Lovelace', 'ada@example.com', 'demo', 'landing', '2026-11-20T10:00:00Z', true, '2026-11-20T10:00:00Z'),
         ($2, 'Old Lead', 'old@example.com', 'partner', 'direct', '2026-11-01T10:00:00Z', false, NULL)`,
      [CONSENTED, NO_CONSENT],
    );
  }, 600_000);

  afterAll(async () => {
    await signupApp?.close();
    await app?.close();
    await unconfiguredApp?.close();
    await db?.stop();
  });

  const list = (instance: FastifyInstance, token: string, query = "") =>
    instance.inject({ method: "GET", url: `/v1/platform/leads${query}`, headers: auth(token) });
  const draft = (instance: FastifyInstance, token: string, id: string, payload: object = { subject: "Hello Ada", body: "Thanks for asking about a demo." }) =>
    instance.inject({ method: "POST", url: `/v1/platform/leads/${id}/followup-drafts`, headers: auth(token), payload });

  it("lets the platform workspace read leads, newest first", async () => {
    const res = await list(app, platformToken);
    expect(res.statusCode).toBe(200);
    const leads = res.json().leads as Array<{ id: string; consentAt: string | null; lastDraftAt: string | null }>;
    expect(leads.map((l) => l.id)).toEqual([CONSENTED, NO_CONSENT]);
    expect(leads[1]!.consentAt).toBeNull();
  });

  it("filters by status and limit", async () => {
    const res = await list(app, platformToken, "?status=closed&limit=5");
    expect(res.statusCode).toBe(200);
    expect(res.json().leads).toEqual([]);
  });

  it("refuses another tenant, even its admin", async () => {
    expect((await list(app, otherToken)).statusCode).toBe(403);
    expect((await draft(app, otherToken, CONSENTED)).statusCode).toBe(403);
  });

  it("refuses everyone when no platform workspace is configured", async () => {
    expect((await list(unconfiguredApp, platformToken)).statusCode).toBe(403);
  });

  it("requires a session", async () => {
    const res = await app.inject({ method: "GET", url: "/v1/platform/leads" });
    expect(res.statusCode).toBe(401);
  });

  it("saves a draft for a consenting lead and shows it on the lead", async () => {
    const res = await draft(app, platformToken, CONSENTED);
    expect(res.statusCode).toBe(201);
    expect(res.json().draft.leadId).toBe(CONSENTED);
    const after = await list(app, platformToken);
    const lead = (after.json().leads as Array<{ id: string; lastDraftAt: string | null }>).find((l) => l.id === CONSENTED);
    expect(lead?.lastDraftAt).not.toBeNull();
  });

  it("writes an audit entry for the draft", async () => {
    const { rows } = await db.adminPool.query(
      "SELECT action FROM audit_log WHERE tenant_id = $1 AND action = 'platform.lead.followup_draft.create'",
      [tenantOf(platformToken)],
    );
    expect(rows.length).toBeGreaterThan(0);
  });

  it("refuses a draft for a lead without consent", async () => {
    expect((await draft(app, platformToken, NO_CONSENT)).statusCode).toBe(409);
  });

  it("returns 404 for an unknown lead and 400 for a bad draft", async () => {
    expect((await draft(app, platformToken, "33333333-3333-4333-8333-333333333333")).statusCode).toBe(404);
    expect((await draft(app, platformToken, CONSENTED, { subject: "", body: "x" })).statusCode).toBe(400);
  });

  it("keeps drafts private to the platform tenant (row-level security)", async () => {
    const { rows } = await db.appPool.query("SELECT count(*)::int AS n FROM lead_followup_drafts");
    expect(rows[0].n).toBe(0); // No tenant context set: the app role sees nothing.
  });
});
