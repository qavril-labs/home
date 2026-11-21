import { describe, expect, it } from "vitest";
import {
  EMAIL_SEND_JOB,
  createEmailSendHandler,
  enqueueEmail,
  type EmailSendJob,
  type NewNotification,
  type NotificationRecord,
  type NotificationStore,
} from "../src";

function memoryStore() {
  const rows = new Map<string, NotificationRecord>();
  const store: NotificationStore = {
    async insert(tenantId: string, input: NewNotification) {
      const row: NotificationRecord = {
        id: input.id, tenantId, channel: "email", templateKey: input.templateKey, toAddress: input.toAddress,
        subject: input.email.subject, bodyText: input.email.text, bodyHtml: input.email.html ?? null,
        status: "queued", attempts: 0, providerMessageId: null, error: null, createdAt: "2026-11-21T00:00:00.000Z", sentAt: null,
      };
      rows.set(input.id, row);
      return row;
    },
    async find(tenantId, id) {
      const r = rows.get(id);
      return r && r.tenantId === tenantId ? r : null;
    },
    async markSent(_t, id, providerMessageId, at) {
      return Object.assign(rows.get(id)!, { status: "sent" as const, attempts: rows.get(id)!.attempts + 1, providerMessageId, sentAt: at.toISOString() });
    },
    async markFailed(_t, id, error) {
      return Object.assign(rows.get(id)!, { status: "failed" as const, attempts: rows.get(id)!.attempts + 1, error });
    },
  };
  return { store, rows };
}

const email = { subject: "s", text: "t" };

describe("enqueueEmail", () => {
  it("stores the message and adds one job keyed by the notification id, with ids only", async () => {
    const { store } = memoryStore();
    const added: { name: string; data: EmailSendJob; jobId: string }[] = [];
    const queue = { add: async (name: string, data: EmailSendJob, o: { jobId: string }) => void added.push({ name, data, jobId: o.jobId }) };
    const record = await enqueueEmail(store, queue, { tenantId: "t1", templateKey: "k", to: "a@b.co", email });
    expect(added).toEqual([{ name: EMAIL_SEND_JOB, data: { tenantId: "t1", notificationId: record.id }, jobId: record.id }]);
    expect(JSON.stringify(added[0]!.data)).not.toContain("a@b.co");
  });

  it("stores nothing and adds no job for a bad address", async () => {
    const { store, rows } = memoryStore();
    const queue = { add: async () => { throw new Error("must not be called"); } };
    await expect(enqueueEmail(store, queue, { tenantId: "t1", templateKey: "k", to: "bad", email })).rejects.toThrow(/Invalid email/);
    expect(rows.size).toBe(0);
  });
});

describe("email send handler", () => {
  it("sends, and does not resend when the job runs again", async () => {
    const { store } = memoryStore();
    const record = await store.insert("t1", { id: "n1", templateKey: "k", toAddress: "a@b.co", email });
    let calls = 0;
    const handler = createEmailSendHandler(store, { send: async () => (calls++, { messageId: "m1" }) });
    await handler({ data: { tenantId: "t1", notificationId: record.id } });
    await handler({ data: { tenantId: "t1", notificationId: record.id } });
    expect(calls).toBe(1);
  });

  it("throws on a provider failure so the queue retries, then succeeds on retry", async () => {
    const { store, rows } = memoryStore();
    await store.insert("t1", { id: "n2", templateKey: "k", toAddress: "a@b.co", email });
    let fail = true;
    const handler = createEmailSendHandler(store, { send: async () => { if (fail) throw new Error("throttled"); return { messageId: "m2" }; } });
    await expect(handler({ data: { tenantId: "t1", notificationId: "n2" } })).rejects.toThrow(/throttled/);
    expect(rows.get("n2")!.status).toBe("failed");
    fail = false;
    await handler({ data: { tenantId: "t1", notificationId: "n2" } });
    expect(rows.get("n2")).toMatchObject({ status: "sent", attempts: 2 });
  });

  it("rejects a job without ids", async () => {
    const { store } = memoryStore();
    const handler = createEmailSendHandler(store, { send: async () => ({ messageId: "x" }) });
    await expect(handler({ data: { tenantId: "", notificationId: "" } })).rejects.toThrow(/needs tenantId/);
  });
});
