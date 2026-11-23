import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { startTestDatabase, type TestDatabase } from "@erp/db/testing";
import type { Clock } from "@erp/kernel";
import { buildApp } from "../src/app";

const PLATFORM_KEY = "platform-key-for-tests-only-0123456789";
const clock: Clock = { now: () => new Date("2026-11-10T09:00:00Z") };

describe("Bank rules engine (FIN-04)", () => {
  let db: TestDatabase;
  let app: FastifyInstance;
  let token: string;
  let otherToken: string;
  let customerId: string;
  let supplierId: string;

  const auth = (t = token) => ({ authorization: `Bearer ${t}` });

  async function signup(email: string, company: string): Promise<string> {
    const res = await app.inject({
      method: "POST",
      url: "/v1/public/signup",
      payload: { name: "Owner", email, password: "a long bank rules password", company, countryCode: "US", baseCurrency: "USD", region: "US", consent: true },
    });
    expect(res.statusCode).toBe(201);
    return res.json().session.token as string;
  }

  async function invoice(number: string, total: string, party = customerId, status = "issued") {
    const res = await app.inject({
      method: "POST", url: "/v1/invoicing/invoices", headers: auth(),
      payload: {
        partyId: party, invoiceNumber: number, issueDate: "2026-10-01", dueDate: "2026-10-31", status,
        subtotal: total, taxTotal: "0.00", total, balanceDue: total,
        lines: [{ sku: "S", description: "Work", quantity: 1, unitPrice: total, lineTotal: total }],
      },
    });
    expect(res.statusCode).toBe(201);
  }

  async function bill(number: string, total: string) {
    const res = await app.inject({
      method: "POST", url: "/v1/invoicing/bills", headers: auth(),
      payload: {
        supplierId, billNumber: number, issueDate: "2026-10-01", dueDate: "2026-10-31", status: "approved",
        subtotal: total, taxTotal: "0.00", total, balanceDue: total,
        lines: [{ sku: "S", description: "Supplies", quantity: 1, unitCost: total, lineTotal: total }],
      },
    });
    expect(res.statusCode).toBe(201);
  }

  const importLines = (lines: object[]) =>
    app.inject({ method: "POST", url: "/v1/banking/statements/import", headers: auth(), payload: { lines } });

  const line = (over: object = {}) => ({
    postedDate: "2026-11-09", reference: "BNK-1", description: "Customer payment", amount: "100.00", direction: "IN", ...over,
  });

  const rule = (over: object = {}) => ({ name: "Stripe payouts", ...over });

  beforeAll(async () => {
    db = await startTestDatabase();
    app = buildApp({ pool: db.appPool, platformKey: PLATFORM_KEY, clock, signupRateLimit: { max: 50, windowMs: 600_000 } });
    token = await signup("rules@example.com", "Rules Shop");
    otherToken = await signup("other@example.com", "Other Shop");
    const c = await app.inject({ method: "POST", url: "/v1/master-data/parties", headers: auth(), payload: { name: "Acme Ltd", partyType: "customer" } });
    customerId = c.json().id;
    const s = await app.inject({ method: "POST", url: "/v1/master-data/parties", headers: auth(), payload: { name: "Paper Co", partyType: "supplier" } });
    supplierId = s.json().id;
  }, 600_000);

  afterAll(async () => {
    await app?.close();
    await db?.stop();
  });

  it("requires sign-in", async () => {
    expect((await app.inject({ method: "GET", url: "/v1/banking/rules" })).statusCode).toBe(401);
    expect((await app.inject({ method: "POST", url: "/v1/banking/rules/apply" })).statusCode).toBe(401);
  });

  it("suggests the single exact-amount invoice with the default rule and no rule id", async () => {
    await invoice("INV-1", "100.10");
    const res = await importLines([line({ amount: "100.10" })]);
    expect(res.statusCode).toBe(201);
    expect(res.json().lines[0]).toMatchObject({ status: "Suggested", matchedRef: "INV-1", matchedLabel: "Acme Ltd", amount: "100.10", confidence: 80 });
    expect(res.json().lines[0].ruleId).toBeUndefined();
  });

  it("does not match an amount that is a cent off", async () => {
    const res = await importLines([line({ amount: "100.11", reference: "BNK-2" })]);
    expect(res.json().lines[0].status).toBe("Unmatched");
  });

  it("never guesses when two documents fit, and reports it", async () => {
    await invoice("INV-A1", "250.00");
    await invoice("INV-A2", "250.00");
    const res = await importLines([line({ amount: "250.00", reference: "BNK-3" })]);
    expect(res.json().ambiguous).toBe(1);
    expect(res.json().lines[0].status).toBe("Unmatched");
  });

  it("matches money out against bills only", async () => {
    await bill("BILL-1", "75.00");
    await invoice("INV-75", "75.00");
    const out = await importLines([line({ amount: "75.00", direction: "OUT", reference: "BNK-4", description: "Paper Co" })]);
    expect(out.json().lines[0]).toMatchObject({ status: "Suggested", matchedRef: "BILL-1", matchedLabel: "Paper Co" });
  });

  it("ignores draft invoices", async () => {
    await invoice("INV-DRAFT", "333.33", customerId, "draft");
    const res = await importLines([line({ amount: "333.33", reference: "BNK-5" })]);
    expect(res.json().lines[0].status).toBe("Unmatched");
  });

  describe("rules", () => {
    let ruleId: string;

    it("creates, lists in priority order and refuses a duplicate name", async () => {
      const created = await app.inject({ method: "POST", url: "/v1/banking/rules", headers: auth(), payload: rule({ priority: 20, matchOn: "reference", confidence: 97, descriptionContains: "stripe" }) });
      expect(created.statusCode).toBe(201);
      ruleId = created.json().rule.id;
      expect(created.json().rule).toMatchObject({ name: "Stripe payouts", priority: 20, matchOn: "reference", confidence: 97, direction: "ANY", amountTolerance: "0.00" });
      await app.inject({ method: "POST", url: "/v1/banking/rules", headers: auth(), payload: rule({ name: "First", priority: 5 }) });
      const list = await app.inject({ method: "GET", url: "/v1/banking/rules", headers: auth() });
      expect(list.json().rules.map((r: { name: string }) => r.name)).toEqual(["First", "Stripe payouts"]);
      const dup = await app.inject({ method: "POST", url: "/v1/banking/rules", headers: auth(), payload: rule({ priority: 30 }) });
      expect(dup.statusCode).toBe(409);
    });

    it("rejects invalid rules", async () => {
      const bad = [
        rule({ name: "min over max", amountMin: "10.00", amountMax: "5.00" }),
        rule({ name: "confidence", confidence: 0 }),
        rule({ name: "float amount", amountMin: "1.005" }),
        rule({ name: "reference with tolerance", matchOn: "reference", amountTolerance: "1.00" }),
        { name: "" },
      ];
      for (const payload of bad) {
        const res = await app.inject({ method: "POST", url: "/v1/banking/rules", headers: auth(), payload });
        expect(res.statusCode, JSON.stringify(payload)).toBe(400);
      }
    });

    it("suggests by rule on import, with the rule's configured confidence", async () => {
      await invoice("INV-0042", "999.00");
      await invoice("INV-0043", "999.00");
      const res = await importLines([line({ amount: "999.00", reference: "Stripe payout INV-0043", description: "STRIPE TRANSFER" })]);
      expect(res.json().lines[0]).toMatchObject({ status: "Suggested", matchedRef: "INV-0043", confidence: 97, ruleId, ruleName: "Stripe payouts" });
    });

    it("applies a new tolerance rule to existing unmatched lines, repeatably", async () => {
      const make = await app.inject({ method: "POST", url: "/v1/banking/rules", headers: auth(), payload: rule({ name: "Small fee", priority: 1, amountTolerance: "0.50", confidence: 70 }) });
      expect(make.statusCode).toBe(201);
      await invoice("INV-FEE", "500.00");
      const imported = await importLines([line({ amount: "499.75", reference: "BNK-FEE", description: "Customer payment less fee" })]);
      // The new rule already applies at import time.
      expect(imported.json().lines[0]).toMatchObject({ status: "Suggested", matchedRef: "INV-FEE", confidence: 70 });
      const first = await app.inject({ method: "POST", url: "/v1/banking/rules/apply", headers: auth() });
      expect(first.statusCode).toBe(200);
      const second = await app.inject({ method: "POST", url: "/v1/banking/rules/apply", headers: auth() });
      expect(second.json().changed).toBe(0);
      expect(second.json().evaluated).toBe(first.json().evaluated);
    });

    it("never changes a reconciled line when rules are applied", async () => {
      const lines = (await app.inject({ method: "GET", url: "/v1/banking/lines?status=Suggested", headers: auth() })).json().lines;
      const target = lines.find((l: { matchedRef: string }) => l.matchedRef === "INV-FEE");
      const rec = await app.inject({ method: "POST", url: "/v1/banking/reconcile", headers: auth(), payload: { lineId: target.id, matchedRef: "INV-FEE" } });
      expect(rec.statusCode).toBe(200);
      await app.inject({ method: "PUT", url: `/v1/banking/rules/${(await ruleByName("Small fee")).id}`, headers: auth(), payload: rule({ name: "Small fee", active: false }) });
      const run = await app.inject({ method: "POST", url: "/v1/banking/rules/apply", headers: auth() });
      expect(run.statusCode).toBe(200);
      const reconciled = (await app.inject({ method: "GET", url: "/v1/banking/lines?status=Reconciled", headers: auth() })).json().lines;
      expect(reconciled).toHaveLength(1);
      expect(reconciled[0]).toMatchObject({ matchedRef: "INV-FEE", status: "Reconciled" });
    });

    it("updates and deletes a rule, and keeps the history in the audit log", async () => {
      const put = await app.inject({ method: "PUT", url: `/v1/banking/rules/${ruleId}`, headers: auth(), payload: rule({ priority: 25, confidence: 60 }) });
      expect(put.statusCode).toBe(200);
      expect(put.json().rule).toMatchObject({ priority: 25, confidence: 60 });
      const del = await app.inject({ method: "DELETE", url: `/v1/banking/rules/${ruleId}`, headers: auth() });
      expect(del.statusCode).toBe(200);
      expect((await app.inject({ method: "DELETE", url: `/v1/banking/rules/${ruleId}`, headers: auth() })).statusCode).toBe(404);
      const audit = await db.adminPool.query(
        "SELECT action FROM audit_log WHERE entity_type = 'bank_rule' AND entity_id = $1 ORDER BY occurred_at, id",
        [ruleId],
      );
      expect(audit.rows.map((r) => r.action).sort()).toEqual(["bank.rule.create", "bank.rule.delete", "bank.rule.update"]);
    });

    it("keeps one workspace's rules and lines away from another", async () => {
      const list = await app.inject({ method: "GET", url: "/v1/banking/rules", headers: auth(otherToken) });
      expect(list.json().rules).toEqual([]);
      const lines = await app.inject({ method: "GET", url: "/v1/banking/lines", headers: auth(otherToken) });
      expect(lines.json().lines).toEqual([]);
      const mine = (await ruleByName("First")).id;
      expect((await app.inject({ method: "PUT", url: `/v1/banking/rules/${mine}`, headers: auth(otherToken), payload: rule({ name: "Stolen" }) })).statusCode).toBe(404);
      expect((await app.inject({ method: "DELETE", url: `/v1/banking/rules/${mine}`, headers: auth(otherToken) })).statusCode).toBe(404);
    });

    async function ruleByName(name: string): Promise<{ id: string }> {
      const list = await app.inject({ method: "GET", url: "/v1/banking/rules", headers: auth() });
      return list.json().rules.find((r: { name: string }) => r.name === name);
    }
  });
});
