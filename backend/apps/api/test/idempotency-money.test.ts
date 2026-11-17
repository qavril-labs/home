import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { startTestDatabase, type TestDatabase } from "@erp/db/testing";
import type { Clock } from "@erp/kernel";
import { buildApp } from "../src/app";

const PLATFORM_KEY = "platform-key-for-tests-only-0123456789";
const clock: Clock = { now: () => new Date("2026-11-10T09:00:00Z") };

describe("idempotent journal, invoice and bill writes", () => {
  let db: TestDatabase;
  let app: FastifyInstance;
  let token: string;
  let companyId: string;

  beforeAll(async () => {
    db = await startTestDatabase();
    app = buildApp({ pool: db.appPool, platformKey: PLATFORM_KEY, clock, signupRateLimit: { max: 50, windowMs: 600_000 } });
    const signup = await app.inject({
      method: "POST",
      url: "/v1/public/signup",
      payload: {
        name: "Money Owner", email: "money-idem@example.com", password: "a long money idempotency password",
        company: "Money Shop", countryCode: "US", baseCurrency: "USD", region: "US", consent: true,
      },
    });
    expect(signup.statusCode).toBe(201);
    token = signup.json().session.token;
    const overview = await app.inject({ method: "GET", url: "/v1/workspace/overview", headers: auth() });
    companyId = overview.json().company.id;
  }, 600_000);

  afterAll(async () => {
    await app?.close();
    await db?.stop();
  });

  const auth = () => ({ authorization: `Bearer ${token}` });

  it("posts a manual journal entry once when retried with the same key", async () => {
    const body = {
      companyId,
      reference: "MJ-0001",
      date: "2026-11-02",
      currency: "USD",
      memo: "Capital",
      lines: [
        { account: "1100", side: "DEBIT", amount: "75.00" },
        { account: "3000", side: "CREDIT", amount: "75.00" },
      ],
    };
    const headers = { ...auth(), "idempotency-key": "journal-key-0001" };
    const first = await app.inject({ method: "POST", url: "/v1/ledger/journal-entries", headers, payload: body });
    const second = await app.inject({ method: "POST", url: "/v1/ledger/journal-entries", headers, payload: body });
    expect(first.statusCode).toBe(201);
    expect(second.statusCode).toBe(201);
    expect(second.json().id).toBe(first.json().id);
    const listed = await app.inject({ method: "GET", url: `/v1/ledger/journal-entries?companyId=${companyId}&limit=200`, headers: auth() });
    expect(listed.json().filter((e: { reference: string }) => e.reference === "MJ-0001")).toHaveLength(1);
  });

  it("reverses an entry once when retried with the same key", async () => {
    const original = await app.inject({
      method: "POST",
      url: "/v1/ledger/journal-entries",
      headers: auth(),
      payload: {
        companyId, reference: "MJ-0002", date: "2026-11-03", currency: "USD", memo: "Rent",
        lines: [
          { account: "6000", side: "DEBIT", amount: "40.00" },
          { account: "1100", side: "CREDIT", amount: "40.00" },
        ],
      },
    });
    const id = original.json().id;
    const headers = { ...auth(), "idempotency-key": "reverse-key-0001" };
    const payload = { companyId, reference: "MJ-0002-R", date: "2026-11-04" };
    const first = await app.inject({ method: "POST", url: `/v1/ledger/journal-entries/${id}/reverse`, headers, payload });
    const second = await app.inject({ method: "POST", url: `/v1/ledger/journal-entries/${id}/reverse`, headers, payload });
    expect(first.statusCode).toBe(201);
    expect(second.json().id).toBe(first.json().id);
    const listed = await app.inject({ method: "GET", url: `/v1/ledger/journal-entries?companyId=${companyId}&limit=200`, headers: auth() });
    expect(listed.json().filter((e: { reversalOf: string | null }) => e.reversalOf === id)).toHaveLength(1);
  });

  it("creates an invoice once when retried with the same key", async () => {
    const party = await app.inject({
      method: "POST",
      url: "/v1/master-data/parties",
      headers: auth(),
      payload: { name: "Acme Ltd", partyType: "customer" },
    });
    expect(party.statusCode).toBe(201);
    const invoice = {
      partyId: party.json().id,
      invoiceNumber: "INV-IDEM-1",
      issueDate: "2026-11-05",
      dueDate: "2026-12-05",
      subtotal: "100.00",
      taxTotal: "0.00",
      total: "100.00",
      lines: [{ sku: "SVC-1", description: "Consulting", quantity: 1, unitPrice: "100.00", lineTotal: "100.00" }],
    };
    const headers = { ...auth(), "idempotency-key": "invoice-key-0001" };
    const first = await app.inject({ method: "POST", url: "/v1/invoicing/invoices", headers, payload: invoice });
    const second = await app.inject({ method: "POST", url: "/v1/invoicing/invoices", headers, payload: invoice });
    expect(first.statusCode, first.body).toBe(201);
    expect(second.statusCode).toBe(201);
    expect(second.json().id).toBe(first.json().id);
    const list = await app.inject({ method: "GET", url: "/v1/invoicing/invoices", headers: auth() });
    expect(list.json().invoices.filter((i: { invoiceNumber: string }) => i.invoiceNumber === "INV-IDEM-1")).toHaveLength(1);
  });

  it("replays the first payment instead of paying again when retried with the same key", async () => {
    const list = await app.inject({ method: "GET", url: "/v1/invoicing/invoices", headers: auth() });
    const invoice = list.json().invoices.find((i: { invoiceNumber: string }) => i.invoiceNumber === "INV-IDEM-1");
    const headers = { ...auth(), "idempotency-key": "pay-key-0001" };
    const first = await app.inject({ method: "POST", url: `/v1/invoicing/invoices/${invoice.id}/pay`, headers });
    const retry = await app.inject({ method: "POST", url: `/v1/invoicing/invoices/${invoice.id}/pay`, headers });
    expect(first.statusCode).toBe(200);
    expect(retry.statusCode).toBe(200);
    expect(retry.json()).toEqual(first.json());
  });
});
