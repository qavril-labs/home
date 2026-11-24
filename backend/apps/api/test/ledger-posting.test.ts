import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { handleInvoiceEvent } from "@erp/db";
import { startTestDatabase, type TestDatabase } from "@erp/db/testing";
import type { Clock } from "@erp/kernel";
import { buildApp } from "../src/app";

const PLATFORM_KEY = "platform-key-for-tests-only-0123456789";
const clock: Clock = { now: () => new Date("2026-11-10T09:00:00Z") };

interface StoredLine { account: string; side: "DEBIT" | "CREDIT"; amount: string }
interface OutboxRow { id: string; tenant_id: string; type: string; payload: unknown }

/** Invoices reach the ledger through the outbox, once, balanced, under the invoice number (SAL-04, FIN-01). */
describe("Invoice posting to the ledger", () => {
  let db: TestDatabase;
  let app: FastifyInstance;
  let token: string;
  let tenantId: string;
  let customerId: string;
  let serviceItemId: string;

  const auth = (extra: Record<string, string> = {}) => ({ authorization: `Bearer ${token}`, ...extra });
  let counter = 0;

  async function createInvoice(over: Record<string, unknown> = {}, lineOver: Record<string, unknown> = {}) {
    counter += 1;
    const res = await app.inject({
      method: "POST", url: "/v1/invoicing/invoices", headers: auth({ "idempotency-key": `posting-key-${counter}` }),
      payload: {
        partyId: customerId, invoiceNumber: `INV-P-${counter}`, issueDate: "2026-11-09", dueDate: "2026-12-09", currency: "USD", status: "issued",
        subtotal: "100.00", taxTotal: "18.00", total: "118.00", balanceDue: "118.00",
        lines: [{ itemId: serviceItemId, sku: "SVC", description: "Consulting", quantity: 1, unitPrice: "100.00", lineTotal: "100.00", ...lineOver }],
        ...over,
      },
    });
    expect(res.statusCode, JSON.stringify(res.json())).toBe(201);
    return res.json() as { id: string; invoiceNumber: string; postingStatus: string; postingError: string | null };
  }

  const events = async (type?: string): Promise<OutboxRow[]> =>
    (await db.adminPool.query("SELECT id, tenant_id, type, payload FROM outbox_events WHERE tenant_id = $1 ORDER BY occurred_at, id", [tenantId])).rows.filter((r: OutboxRow) => !type || r.type === type);
  const eventFor = async (type: string, invoiceId: string): Promise<OutboxRow> => {
    const found = (await events(type)).find((e) => (e.payload as { invoiceId: string }).invoiceId === invoiceId);
    expect(found, `${type} for ${invoiceId}`).toBeTruthy();
    return found as OutboxRow;
  };
  const deliver = (e: OutboxRow) => handleInvoiceEvent(db.appPool, clock, { type: e.type, tenantId: e.tenant_id, payload: e.payload });
  const entry = async (reference: string): Promise<{ lines: StoredLine[]; reversal_of: string | null } | null> =>
    (await db.adminPool.query("SELECT lines, reversal_of FROM ledger_entries WHERE tenant_id = $1 AND reference = $2", [tenantId, reference])).rows[0] ?? null;
  const entryCount = async (): Promise<number> =>
    (await db.adminPool.query("SELECT count(*)::int AS n FROM ledger_entries WHERE tenant_id = $1", [tenantId])).rows[0].n;
  const state = async (id: string) =>
    (await db.adminPool.query("SELECT posting_status, ledger_entry_id, posting_error FROM invoices WHERE id = $1", [id])).rows[0];

  beforeAll(async () => {
    db = await startTestDatabase();
    app = buildApp({ pool: db.appPool, platformKey: PLATFORM_KEY, clock, signupRateLimit: { max: 50, windowMs: 600_000 } });
    const signup = await app.inject({
      method: "POST", url: "/v1/public/signup",
      payload: { name: "Post Owner", email: "post@example.com", password: "a long posting password", company: "Post Shop", countryCode: "US", baseCurrency: "USD", region: "US", consent: true },
    });
    expect(signup.statusCode).toBe(201);
    token = signup.json().session.token;
    tenantId = signup.json().tenantId;
    customerId = (await app.inject({ method: "POST", url: "/v1/master-data/parties", headers: auth(), payload: { name: "Acme Ltd", partyType: "customer" } })).json().id;
    serviceItemId = (await app.inject({ method: "POST", url: "/v1/master-data/items", headers: auth(), payload: { sku: "SVC", name: "Consulting", itemType: "service", unitPrice: "100.00" } })).json().id;
    // Per-item and per-party accounts are set by the owner through SQL until the master-data API exposes them.
    await db.adminPool.query("UPDATE items SET revenue_account = '4100' WHERE id = $1", [serviceItemId]);
  }, 600_000);

  afterAll(async () => {
    await app?.close();
    await db?.stop();
  });

  it("queues an issued invoice in the same transaction, then posts it balanced under its number", async () => {
    const invoice = await createInvoice();
    expect(invoice.postingStatus).toBe("PENDING");
    const outcome = await deliver(await eventFor("sales.invoice.issued", invoice.id));
    expect(outcome).toMatchObject({ result: "POSTED" });
    const posted = await entry(invoice.invoiceNumber);
    expect(posted?.lines.map((l) => [l.account, l.side, l.amount])).toEqual([
      ["1200", "DEBIT", "118.00"],
      ["4100", "CREDIT", "100.00"], // the item's own income account, not the default 4000
      ["2100", "CREDIT", "18.00"],
    ]);
    expect(await state(invoice.id)).toMatchObject({ posting_status: "POSTED", posting_error: null });
    expect((await state(invoice.id)).ledger_entry_id).toBeTruthy();
  });

  it("does nothing on redelivery: no second entry, same state", async () => {
    const invoice = await createInvoice();
    const event = await eventFor("sales.invoice.issued", invoice.id);
    await deliver(event);
    const before = await entryCount();
    expect(await deliver(event)).toMatchObject({ result: "ALREADY_POSTED" });
    expect(await entryCount()).toBe(before);
  });

  it("does not repeat the event for an idempotent replay of the create request", async () => {
    const payload = {
      partyId: customerId, invoiceNumber: "INV-REPLAY", issueDate: "2026-11-09", dueDate: "2026-12-09", currency: "USD", status: "issued",
      subtotal: "10.00", taxTotal: "0.00", total: "10.00", balanceDue: "10.00",
      lines: [{ sku: "X", description: "x", quantity: 1, unitPrice: "10.00", lineTotal: "10.00" }],
    };
    const headers = auth({ "idempotency-key": "replay-key-1" });
    const first = await app.inject({ method: "POST", url: "/v1/invoicing/invoices", headers, payload });
    const second = await app.inject({ method: "POST", url: "/v1/invoicing/invoices", headers, payload });
    expect(second.json().id).toBe(first.json().id);
    const matching = (await events("sales.invoice.issued")).filter((e) => (e.payload as { invoiceId: string }).invoiceId === first.json().id);
    expect(matching).toHaveLength(1);
  });

  it("posts nothing for a draft, and queues it when the draft is issued", async () => {
    const draft = await createInvoice({ status: "draft" });
    expect(draft.postingStatus).toBe("NOT_POSTED");
    expect((await events("sales.invoice.issued")).filter((e) => (e.payload as { invoiceId: string }).invoiceId === draft.id)).toHaveLength(0);
    const issued = await app.inject({ method: "PUT", url: `/v1/invoicing/invoices/${draft.id}`, headers: auth(), payload: { status: "issued" } });
    expect(issued.statusCode).toBe(200);
    expect(issued.json().postingStatus).toBe("PENDING");
    await deliver(await eventFor("sales.invoice.issued", draft.id));
    expect(await entry(draft.invoiceNumber)).toBeTruthy();
  });

  it("posts the payment against the receivable, and not before the invoice is in the books", async () => {
    const invoice = await createInvoice({ invoiceNumber: "INV-PAY-1" });
    const pay = await app.inject({ method: "POST", url: `/v1/invoicing/invoices/${invoice.id}/pay`, headers: auth({ "idempotency-key": "pay-key-1" }) });
    expect(pay.statusCode).toBe(200);
    const paid = await eventFor("sales.invoice.paid", invoice.id);
    expect(paid.payload).toMatchObject({ amount: "118.00", date: "2026-11-10", sequence: 1 });
    // The payment arrives first: it must wait (throw, so the queue retries) rather than post against nothing.
    await expect(deliver(paid)).rejects.toThrow(/not posted yet/);
    await deliver(await eventFor("sales.invoice.issued", invoice.id));
    expect(await deliver(paid)).toMatchObject({ result: "POSTED" });
    expect((await entry("INV-PAY-1/PAY/1"))?.lines.map((l) => [l.account, l.side, l.amount])).toEqual([
      ["1100", "DEBIT", "118.00"],
      ["1200", "CREDIT", "118.00"],
    ]);
    // Receivables net to zero across the invoice and its payment.
    const receivable = (await db.adminPool.query(
      `SELECT sum(CASE WHEN l->>'side' = 'DEBIT' THEN (l->>'amount')::numeric ELSE -(l->>'amount')::numeric END)::text AS balance
         FROM ledger_entries e, jsonb_array_elements(e.lines) l
        WHERE e.tenant_id = $1 AND e.reference IN ('INV-PAY-1', 'INV-PAY-1/PAY/1') AND l->>'account' = '1200'`, [tenantId])).rows[0].balance;
    expect(receivable).toBe("0.00");
    // Paying again posts no second payment event.
    await app.inject({ method: "POST", url: `/v1/invoicing/invoices/${invoice.id}/pay`, headers: auth({ "idempotency-key": "pay-key-2" }) });
    expect((await events("sales.invoice.paid")).filter((e) => (e.payload as { invoiceId: string }).invoiceId === invoice.id)).toHaveLength(1);
  });

  it("marks an invoice whose lines do not add up as FAILED with the reason, and posts nothing", async () => {
    const before = await entryCount();
    const invoice = await createInvoice({ invoiceNumber: "INV-BAD-1", total: "130.00", balanceDue: "130.00" });
    expect(await deliver(await eventFor("sales.invoice.issued", invoice.id))).toMatchObject({ result: "FAILED" });
    expect(await state(invoice.id)).toMatchObject({ posting_status: "FAILED" });
    expect((await state(invoice.id)).posting_error).toContain("do not add up");
    expect(await entryCount()).toBe(before);
    const shown = await app.inject({ method: "GET", url: `/v1/invoicing/invoices/${invoice.id}`, headers: auth() });
    expect(shown.json()).toMatchObject({ postingStatus: "FAILED" });
  });

  it("marks a foreign-currency invoice FAILED instead of posting it at the wrong value", async () => {
    const invoice = await createInvoice({ invoiceNumber: "INV-EUR-1", currency: "EUR" });
    expect(await deliver(await eventFor("sales.invoice.issued", invoice.id))).toMatchObject({ result: "FAILED" });
    expect((await state(invoice.id)).posting_error).toContain("EUR");
  });

  it("marks an invoice FAILED when an account in the chart does not exist", async () => {
    await db.adminPool.query("UPDATE parties SET receivable_account = '1299' WHERE id = $1", [customerId]);
    const invoice = await createInvoice({ invoiceNumber: "INV-ACC-1" });
    const outcome = await deliver(await eventFor("sales.invoice.issued", invoice.id));
    await db.adminPool.query("UPDATE parties SET receivable_account = NULL WHERE id = $1", [customerId]);
    expect(outcome).toMatchObject({ result: "FAILED" });
    expect((await state(invoice.id)).posting_error).toMatch(/1299/);
  });

  describe("until edits post a reversal (stage 2), an invoice in the books cannot drift from the ledger", () => {
    it("refuses a change of amount or status, and refuses a delete", async () => {
      const invoice = await createInvoice({ invoiceNumber: "INV-GUARD-1" });
      const money = await app.inject({ method: "PUT", url: `/v1/invoicing/invoices/${invoice.id}`, headers: auth(), payload: { total: "999.00" } });
      expect(money.statusCode).toBe(409);
      expect(money.json().error.details.fields).toEqual(["total"]);
      const status = await app.inject({ method: "PUT", url: `/v1/invoicing/invoices/${invoice.id}`, headers: auth(), payload: { status: "paid" } });
      expect(status.statusCode).toBe(409);
      const del = await app.inject({ method: "DELETE", url: `/v1/invoicing/invoices/${invoice.id}`, headers: auth() });
      expect(del.statusCode).toBe(409);
    });
    it("still allows fields that do not touch money, and an unchanged value", async () => {
      const invoice = await createInvoice({ invoiceNumber: "INV-GUARD-2" });
      const ok = await app.inject({ method: "PUT", url: `/v1/invoicing/invoices/${invoice.id}`, headers: auth(), payload: { notes: "thanks", total: "118.00" } });
      expect(ok.statusCode).toBe(200);
      expect(ok.json().notes).toBe("thanks");
    });
    it("leaves older, never-posted invoices as editable as before", async () => {
      const invoice = await createInvoice({ invoiceNumber: "INV-OLD-1", status: "paid", amountPaid: "118.00", balanceDue: "0.00" });
      expect(invoice.postingStatus).toBe("NOT_POSTED");
      const edit = await app.inject({ method: "PUT", url: `/v1/invoicing/invoices/${invoice.id}`, headers: auth(), payload: { total: "120.00" } });
      expect(edit.statusCode).toBe(200);
      expect((await app.inject({ method: "DELETE", url: `/v1/invoicing/invoices/${invoice.id}`, headers: auth() })).statusCode).toBe(204);
    });
  });
});
