import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { verifyChain } from "@erp/audit";
import { IdentityService } from "@erp/identity";
import { startTestDatabase, type TestDatabase } from "@erp/db/testing";
import { PgAuditStore, PgIdentityRepository, withTenantTransaction } from "@erp/db";
import { buildApp } from "../src/app";

const PLATFORM_KEY = "platform-key-for-tests-only-0123456789";
const PASSWORD = "correct-horse-battery";
const REASON = "Invoice INV-2026-000004 is 14 days late; the reminder was drafted by the bot.";

describe("approval queue API", () => {
  let db: TestDatabase;
  let app: FastifyInstance;
  let tenantId: string;
  let companyId: string;
  let requesterToken: string;
  let approverToken: string;
  let requestId: string;

  const login = async (email: string): Promise<string> => {
    const response = await app.inject({ method: "POST", url: "/v1/auth/login", payload: { tenantSlug: "approve-co", email, password: PASSWORD } });
    return response.json().token as string;
  };

  const call = (method: "GET" | "POST", url: string, token: string | null, payload?: object) =>
    app.inject({ method, url, headers: token ? { authorization: `Bearer ${token}` } : {}, payload });

  beforeAll(async () => {
    db = await startTestDatabase();
    app = buildApp({ pool: db.appPool, platformKey: PLATFORM_KEY });
    const created = await app.inject({
      method: "POST",
      url: "/v1/platform/tenants",
      headers: { "x-platform-key": PLATFORM_KEY },
      payload: {
        tenant: { slug: "approve-co", name: "Approve Co", region: "EU" },
        company: { legalName: "Approve Co GmbH", countryCode: "DE", baseCurrency: "EUR", fiscalYearStartMonth: 1 },
        admin: { email: "owner@approve.example", password: PASSWORD },
      },
    });
    expect(created.statusCode).toBe(201);
    tenantId = created.json().tenant.id;
    companyId = created.json().company.id;

    // A second administrator, so one person can request and another can decide.
    await withTenantTransaction(db.appPool, tenantId, (tx) =>
      new IdentityService(new PgIdentityRepository(tx), tenantId).createUser({
        email: "manager@approve.example",
        password: PASSWORD,
        roles: ["tenant_admin"],
      }),
    );
    requesterToken = await login("owner@approve.example");
    approverToken = await login("manager@approve.example");
  }, 240_000);

  afterAll(async () => {
    await app?.close();
    await db?.stop();
  });

  it("holds a request as pending with its reason", async () => {
    const response = await call("POST", "/v1/approvals", requesterToken, {
      companyId,
      kind: "BOT_ACTION",
      reason: REASON,
      payload: { bot: "chase-chloe", action: "SEND_REMINDER" },
    });
    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({ status: "PENDING", reason: REASON });
    requestId = response.json().id;
  });

  it("refuses the requester deciding their own request", async () => {
    const response = await call("POST", `/v1/approvals/${requestId}/approve`, requesterToken, { companyId });
    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe("FORBIDDEN");
  });

  it("lists pending requests and lets a second person approve", async () => {
    const pending = await call("GET", `/v1/approvals?companyId=${companyId}&status=PENDING`, approverToken);
    expect(pending.json().map((item: { id: string }) => item.id)).toContain(requestId);

    const approved = await call("POST", `/v1/approvals/${requestId}/approve`, approverToken, { companyId, note: "Reminder is fine." });
    expect(approved.statusCode).toBe(200);
    expect(approved.json()).toMatchObject({ status: "APPROVED", decisionNote: "Reminder is fine." });
  });

  it("refuses a second decision on the same request", async () => {
    const response = await call("POST", `/v1/approvals/${requestId}/reject`, approverToken, { companyId, note: "Changed my mind." });
    expect(response.statusCode).toBe(409);
  });

  it("needs a note to reject", async () => {
    const created = await call("POST", "/v1/approvals", requesterToken, {
      companyId,
      kind: "CREDIT_NOTE",
      reason: "Customer returned two cases of stock; credit the full amount.",
      payload: { invoice: "INV-2026-000009" },
    });
    const id = created.json().id as string;
    const withoutNote = await call("POST", `/v1/approvals/${id}/reject`, approverToken, { companyId });
    expect(withoutNote.statusCode).toBe(400);
    const rejected = await call("POST", `/v1/approvals/${id}/reject`, approverToken, { companyId, note: "Amount is too high." });
    expect(rejected.json().status).toBe("REJECTED");
  });

  it("lets only the requester withdraw", async () => {
    const created = await call("POST", "/v1/approvals", requesterToken, {
      companyId,
      kind: "PURCHASE_ORDER",
      reason: "Restock the best-selling milk line before the weekend.",
      payload: { supplier: "Dairy Co" },
    });
    const id = created.json().id as string;
    const byOther = await call("POST", `/v1/approvals/${id}/withdraw`, approverToken, { companyId });
    expect(byOther.statusCode).toBe(403);
    const byRequester = await call("POST", `/v1/approvals/${id}/withdraw`, requesterToken, { companyId });
    expect(byRequester.json().status).toBe("WITHDRAWN");
  });

  it("requires a signed-in user", async () => {
    const response = await call("POST", "/v1/approvals", null, { companyId, kind: "BOT_ACTION", reason: REASON, payload: {} });
    expect(response.statusCode).toBe(401);
  });

  it("writes every decision to the audit chain, and the chain verifies", async () => {
    const chain = await withTenantTransaction(db.appPool, tenantId, (tx) => new PgAuditStore(tx).listForTenant(tenantId));
    const approvalActions = chain.filter((entry) => entry.entityType === "approval").map((entry) => entry.action);
    expect(approvalActions).toEqual(expect.arrayContaining(["REQUEST", "APPROVE", "REJECT", "WITHDRAW"]));
    expect(verifyChain(chain)).toMatchObject({ ok: true });
  });
});
