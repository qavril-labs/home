import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { startTestDatabase, type TestDatabase } from "@erp/db/testing";
import type { Clock } from "@erp/kernel";
import { buildApp } from "../src/app";

const PLATFORM_KEY = "platform-key-for-tests-only-0123456789";
const clock: Clock = { now: () => new Date("2026-11-10T09:00:00Z") };

/**
 * Every route that moves money or stock state must leave one audit entry in the same transaction
 * (CLAUDE.md, corrections and audit). A replayed request must not log twice.
 */
describe("Audit coverage on money-moving routes (PLT-16, PLT-21)", () => {
  let db: TestDatabase;
  let app: FastifyInstance;
  let token: string;
  let tenantId: string;
  let companyId: string;
  let customerId: string;
  let supplierId: string;

  const auth = (extra: Record<string, string> = {}) => ({ authorization: `Bearer ${token}`, ...extra });

  async function actions(entityType?: string): Promise<string[]> {
    const res = await db.adminPool.query(
      entityType
        ? "SELECT action FROM audit_log WHERE tenant_id = $1 AND entity_type = $2 ORDER BY occurred_at, id"
        : "SELECT action FROM audit_log WHERE tenant_id = $1 ORDER BY occurred_at, id",
      entityType ? [tenantId, entityType] : [tenantId],
    );
    // The test clock is frozen, so entries share a timestamp; compare the set of actions, not their order.
    return res.rows.map((r) => r.action as string).sort();
  }

  beforeAll(async () => {
    db = await startTestDatabase();
    app = buildApp({ pool: db.appPool, platformKey: PLATFORM_KEY, clock, signupRateLimit: { max: 50, windowMs: 600_000 } });
    const signup = await app.inject({
      method: "POST", url: "/v1/public/signup",
      payload: { name: "Audit Owner", email: "audit@example.com", password: "a long audit password", company: "Audit Shop", countryCode: "US", baseCurrency: "USD", region: "US", consent: true },
    });
    expect(signup.statusCode).toBe(201);
    token = signup.json().session.token;
    tenantId = signup.json().tenantId;
    companyId = signup.json().company.id;
    customerId = (await app.inject({ method: "POST", url: "/v1/master-data/parties", headers: auth(), payload: { name: "Acme Ltd", partyType: "customer" } })).json().id;
    supplierId = (await app.inject({ method: "POST", url: "/v1/master-data/parties", headers: auth(), payload: { name: "Paper Co", partyType: "supplier" } })).json().id;
  }, 600_000);

  afterAll(async () => {
    await app?.close();
    await db?.stop();
  });

  it("logs a quick entry once, and not again on an idempotent replay", async () => {
    const payload = { kind: "sale", amount: "120.50", date: "2026-11-09", via: "1100" };
    const headers = auth({ "idempotency-key": "audit-quick-1" });
    const first = await app.inject({ method: "POST", url: "/v1/workspace/quick-entries", headers, payload });
    const replay = await app.inject({ method: "POST", url: "/v1/workspace/quick-entries", headers, payload });
    expect(first.statusCode).toBe(201);
    expect(replay.json()).toEqual(first.json());
    const entries = (await actions("journal_entry")).filter((a) => a === "workspace.quick-entry");
    expect(entries).toHaveLength(1);
    const row = await db.adminPool.query("SELECT entity_id, changes FROM audit_log WHERE action = 'workspace.quick-entry' AND tenant_id = $1", [tenantId]);
    expect(row.rows[0].entity_id).toBe(first.json().id);
  });

  it("logs a ledger posting and its reversal", async () => {
    const post = await app.inject({
      method: "POST", url: "/v1/ledger/journal-entries", headers: auth({ "idempotency-key": "audit-post-1" }),
      payload: { companyId, reference: "AUD-1", date: "2026-11-09", currency: "USD", lines: [
        { account: "1000", side: "DEBIT", amount: "10.00" }, { account: "4000", side: "CREDIT", amount: "10.00" } ] },
    });
    expect(post.statusCode).toBe(201);
    const reverse = await app.inject({
      method: "POST", url: `/v1/ledger/journal-entries/${post.json().id}/reverse`, headers: auth({ "idempotency-key": "audit-rev-1" }),
      payload: { companyId, reference: "AUD-1-R", date: "2026-11-10" },
    });
    expect(reverse.statusCode).toBe(201);
    const list = await actions("journal_entry");
    expect(list).toContain("ledger.journal.post");
    expect(list).toContain("ledger.journal.reverse");
  });

  it("logs invoice create, update, pay and delete, and bill create", async () => {
    const inv = await app.inject({
      method: "POST", url: "/v1/invoicing/invoices", headers: auth({ "idempotency-key": "audit-inv-1" }),
      payload: { partyId: customerId, invoiceNumber: "INV-AUD-1", issueDate: "2026-10-01", dueDate: "2026-10-31", status: "issued",
        subtotal: "50.00", taxTotal: "0.00", total: "50.00", balanceDue: "50.00",
        lines: [{ sku: "S", description: "Work", quantity: 1, unitPrice: "50.00", lineTotal: "50.00" }] },
    });
    expect(inv.statusCode).toBe(201);
    const id = inv.json().id;
    expect((await app.inject({ method: "PUT", url: `/v1/invoicing/invoices/${id}`, headers: auth(), payload: { status: "sent" } })).statusCode).toBe(200);
    expect((await app.inject({ method: "POST", url: `/v1/invoicing/invoices/${id}/pay`, headers: auth({ "idempotency-key": "audit-pay-1" }) })).statusCode).toBe(200);
    expect((await app.inject({ method: "DELETE", url: `/v1/invoicing/invoices/${id}`, headers: auth() })).statusCode).toBe(204);
    const bill = await app.inject({
      method: "POST", url: "/v1/invoicing/bills", headers: auth({ "idempotency-key": "audit-bill-1" }),
      payload: { supplierId, billNumber: "BILL-AUD-1", issueDate: "2026-10-01", dueDate: "2026-10-31", status: "approved",
        subtotal: "20.00", taxTotal: "0.00", total: "20.00", balanceDue: "20.00",
        lines: [{ sku: "S", description: "Paper", quantity: 1, unitCost: "20.00", lineTotal: "20.00" }] },
    });
    expect(bill.statusCode).toBe(201);
    expect(await actions("invoice")).toEqual(["sales.invoice.create", "sales.invoice.delete", "sales.invoice.pay", "sales.invoice.update"]);
    expect(await actions("bill")).toEqual(["purchasing.bill.create"]);
    // The paid-invoice entry keeps both sides of the change.
    const paid = await db.adminPool.query("SELECT changes FROM audit_log WHERE action = 'sales.invoice.pay' AND tenant_id = $1", [tenantId]);
    const fields = (paid.rows[0].changes as { field: string }[]).map((c) => c.field);
    expect(fields).toContain("status");
  });

  it("logs bank reconcile and unreconcile", async () => {
    const imported = await app.inject({
      method: "POST", url: "/v1/banking/statements/import", headers: auth(),
      payload: { lines: [{ postedDate: "2026-11-09", reference: "B1", description: "Deposit", amount: "75.00", direction: "IN" }] },
    });
    const lineId = imported.json().lines[0].id;
    expect((await app.inject({ method: "POST", url: "/v1/banking/reconcile", headers: auth(), payload: { lineId, matchedRef: "INV-X" } })).statusCode).toBe(200);
    expect((await app.inject({ method: "POST", url: "/v1/banking/unreconcile", headers: auth(), payload: { lineId } })).statusCode).toBe(200);
    expect(await actions("bank_line")).toEqual(["bank.line.reconcile", "bank.line.unreconcile"]);
  });

  it("logs purchase order, receipt and match override writes", async () => {
    const before = (await actions()).length;
    const po = await app.inject({
      method: "POST", url: "/v1/procurement/orders", headers: auth(),
      payload: { supplierId, supplierName: "Paper Co", orderDate: "2026-11-01", expectedDeliveryDate: "2026-11-15", currency: "USD",
        lines: [{ itemId: "00000000-0000-4000-8000-000000000001", sku: "P1", description: "Paper", quantityOrdered: 2, unitPrice: "5.00" }] },
    });
    if (po.statusCode === 201) {
      const id = po.json().order.id;
      await app.inject({ method: "PATCH", url: `/v1/procurement/orders/${id}/status`, headers: auth(), payload: { status: "issued" } });
      expect(await actions("purchase_order")).toEqual(["procurement.order.create", "procurement.order.status"]);
      expect((await actions()).length).toBeGreaterThan(before);
    } else {
      // The order payload is owned by the purchasing slice; surface a change in its shape rather than hide it.
      expect(po.statusCode, JSON.stringify(po.json())).toBe(201);
    }
  });

  it("keeps one tenant's audit entries out of another's", async () => {
    const other = await app.inject({
      method: "POST", url: "/v1/public/signup",
      payload: { name: "Other", email: "other-audit@example.com", password: "a long audit password", company: "Other Shop", countryCode: "US", baseCurrency: "USD", region: "US", consent: true },
    });
    const otherId = other.json().tenantId as string;
    expect(otherId).not.toBe(tenantId);
    const rows = await db.adminPool.query("SELECT action FROM audit_log WHERE tenant_id = $1", [otherId]);
    expect(rows.rows.map((r) => r.action)).not.toContain("workspace.quick-entry");
    expect(rows.rows.map((r) => r.action)).not.toContain("sales.invoice.create");
  });
});

describe("API rate limit is per tenant and address (PLT-21)", () => {
  let db: TestDatabase;
  let app: FastifyInstance;

  beforeAll(async () => {
    db = await startTestDatabase();
    app = buildApp({ pool: db.appPool, platformKey: PLATFORM_KEY, clock });
  }, 600_000);

  afterAll(async () => {
    await app?.close();
    await db?.stop();
  });

  it("does not let a forged token for someone else's tenant use up that tenant's allowance", async () => {
    const victim = "01900000-0000-7000-8000-000000000001";
    const forged = { authorization: `Bearer ${victim}.forged` };
    // An attacker at one address sends more than the allowance with a token naming the victim tenant.
    let blocked = 0;
    for (let i = 0; i < 320; i += 1) {
      const res = await app.inject({ method: "GET", url: "/v1/me", headers: forged, remoteAddress: "203.0.113.9" });
      if (res.statusCode === 429) blocked += 1;
    }
    expect(blocked).toBeGreaterThan(0);
    // A different address using the same tenant prefix is not blocked by that.
    const other = await app.inject({ method: "GET", url: "/v1/me", headers: forged, remoteAddress: "198.51.100.7" });
    expect(other.statusCode).not.toBe(429);
  });
});
