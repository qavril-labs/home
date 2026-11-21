import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { startTestDatabase, type TestDatabase } from "@erp/db/testing";
import type { Clock } from "@erp/kernel";
import { buildApp } from "../src/app";

const PLATFORM_KEY = "platform-key-for-tests-only-0123456789";
const clock: Clock = { now: () => new Date("2026-11-10T09:00:00Z") };

describe("Chase Chloe reminders send through the notifications queue (FIN-14, PLT-10)", () => {
  let db: TestDatabase;
  let withQueue: FastifyInstance;
  let withoutQueue: FastifyInstance;
  let token: string;
  let invoiceId: string;
  const jobs: { name: string; data: { tenantId: string; notificationId: string }; jobId: string }[] = [];

  beforeAll(async () => {
    db = await startTestDatabase();
    const queue = { add: async (name: string, data: { tenantId: string; notificationId: string }, o: { jobId: string }) => void jobs.push({ name, data, jobId: o.jobId }) };
    withQueue = buildApp({ pool: db.appPool, platformKey: PLATFORM_KEY, clock, emailQueue: queue, signupRateLimit: { max: 50, windowMs: 600_000 } });
    withoutQueue = buildApp({ pool: db.appPool, platformKey: PLATFORM_KEY, clock });
    const signup = await withQueue.inject({
      method: "POST",
      url: "/v1/public/signup",
      payload: {
        name: "Rem Owner", email: "rem@example.com", password: "a long reminder password", company: "Rem Shop",
        countryCode: "US", baseCurrency: "USD", region: "US", consent: true,
      },
    });
    expect(signup.statusCode).toBe(201);
    token = signup.json().session.token;
    const party = await withQueue.inject({ method: "POST", url: "/v1/master-data/parties", headers: auth(), payload: { name: "Acme Ltd", partyType: "customer" } });
    const invoice = await withQueue.inject({
      method: "POST",
      url: "/v1/invoicing/invoices",
      headers: auth(),
      payload: {
        partyId: party.json().id, invoiceNumber: "INV-REM-1", issueDate: "2026-10-01", dueDate: "2026-10-15",
        subtotal: "100.00", taxTotal: "0.00", total: "100.00",
        lines: [{ sku: "S", description: "Work", quantity: 1, unitPrice: "100.00", lineTotal: "100.00" }],
      },
    });
    invoiceId = invoice.json().id;
  }, 600_000);

  afterAll(async () => {
    await withQueue?.close();
    await withoutQueue?.close();
    await db?.stop();
  });

  const auth = () => ({ authorization: `Bearer ${token}` });
  const reminder = (extra: object = {}) => ({
    invoiceId, channel: "email", recipient: "ap@acme.example", recipientName: "Acme AP",
    subject: "Invoice INV-REM-1 is overdue", message: "Please pay 100.00 USD.", tone: "friendly", ...extra,
  });

  it("queues one email job and records the reminder as sent", async () => {
    const res = await withQueue.inject({ method: "POST", url: "/v1/invoicing/reminders", headers: auth(), payload: reminder() });
    expect(res.statusCode).toBe(201);
    expect(res.json().status).toBe("sent");
    expect(res.json().notificationId).toBeTruthy();
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({ name: "email.send", jobId: res.json().notificationId });
    expect(JSON.stringify(jobs[0]!.data)).not.toContain("ap@acme.example");
  });

  it("records approved, not sent, when no queue can deliver the email", async () => {
    const res = await withoutQueue.inject({ method: "POST", url: "/v1/invoicing/reminders", headers: auth(), payload: reminder() });
    expect(res.statusCode).toBe(201);
    expect(res.json().status).toBe("approved");
    expect(res.json().notificationId).toBeNull();
  });

  it("does not claim a WhatsApp reminder was sent", async () => {
    const before = jobs.length;
    const res = await withQueue.inject({ method: "POST", url: "/v1/invoicing/reminders", headers: auth(), payload: reminder({ channel: "whatsapp", recipient: "+15550100" }) });
    expect(res.json().status).toBe("approved");
    expect(jobs).toHaveLength(before);
  });

  it("queues nothing for a draft", async () => {
    const before = jobs.length;
    const res = await withQueue.inject({ method: "POST", url: "/v1/invoicing/reminders", headers: auth(), payload: reminder({ status: "draft" }) });
    expect(res.json().status).toBe("draft");
    expect(jobs).toHaveLength(before);
  });

  it("refuses a bad address and records no reminder", async () => {
    const before = jobs.length;
    const res = await withQueue.inject({ method: "POST", url: "/v1/invoicing/reminders", headers: auth(), payload: reminder({ recipient: "not-an-address" }) });
    expect(res.statusCode).toBe(400);
    expect(jobs).toHaveLength(before);
  });
});
