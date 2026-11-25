import { describe, expect, it } from "vitest";
import {
  deliver,
  queueEmail,
  renderTemplate,
  SesEmailProvider,
  type EmailProvider,
  type NewNotification,
  type NotificationRecord,
  type NotificationStore,
} from "../src";

class MemoryStore implements NotificationStore {
  rows = new Map<string, NotificationRecord>();
  async insert(tenantId: string, input: NewNotification) {
    const row: NotificationRecord = {
      id: input.id,
      tenantId,
      channel: "email",
      templateKey: input.templateKey,
      toAddress: input.toAddress,
      subject: input.email.subject,
      bodyText: input.email.text,
      bodyHtml: input.email.html ?? null,
      status: "queued",
      attempts: 0,
      providerMessageId: null,
      error: null,
      createdAt: "2026-11-21T00:00:00.000Z",
      sentAt: null,
    };
    this.rows.set(`${tenantId}:${row.id}`, row);
    return row;
  }
  async find(tenantId: string, id: string) {
    return this.rows.get(`${tenantId}:${id}`) ?? null;
  }
  async markSent(tenantId: string, id: string, providerMessageId: string, at: Date) {
    const row = this.rows.get(`${tenantId}:${id}`)!;
    Object.assign(row, { status: "sent", attempts: row.attempts + 1, providerMessageId, sentAt: at.toISOString(), error: null });
    return row;
  }
  async markFailed(tenantId: string, id: string, error: string) {
    const row = this.rows.get(`${tenantId}:${id}`)!;
    Object.assign(row, { status: "failed", attempts: row.attempts + 1, error });
    return row;
  }
}

const template = {
  key: "invoice.reminder",
  subject: "Invoice {{number}} is overdue",
  text: "Hello {{name}}, invoice {{number}} for {{amount}} is overdue.",
  html: "<p>Hello {{name}}</p>",
};

describe("renderTemplate", () => {
  it("fills placeholders", () => {
    const out = renderTemplate(template, { number: "INV-1", name: "Ada", amount: "USD 10.00" });
    expect(out.subject).toBe("Invoice INV-1 is overdue");
    expect(out.text).toContain("USD 10.00");
  });

  it("refuses a missing value instead of leaving a gap", () => {
    expect(() => renderTemplate(template, { number: "INV-1", name: "Ada" })).toThrow(/amount/);
  });

  it("escapes HTML values but not plain text", () => {
    const out = renderTemplate(template, { number: "1", name: "<b>&", amount: "1" });
    expect(out.html).toBe("<p>Hello &lt;b&gt;&amp;</p>");
    expect(out.text).toContain("1");
  });

  it("refuses line breaks in the subject", () => {
    expect(() => renderTemplate(template, { number: "1\nBcc: x@y.z", name: "a", amount: "1" })).toThrow(/single line/);
  });
});

describe("queue and deliver", () => {
  const email = { subject: "s", text: "t" };

  it("rejects a bad address before storing anything", async () => {
    const store = new MemoryStore();
    await expect(queueEmail(store, { tenantId: "t1", templateKey: "k", to: "not-an-address", email })).rejects.toThrow(/Invalid email/);
    expect(store.rows.size).toBe(0);
  });

  it("sends once and never twice", async () => {
    const store = new MemoryStore();
    let calls = 0;
    const provider: EmailProvider = { send: async () => (calls++, { messageId: "m-1" }) };
    const queued = await queueEmail(store, { tenantId: "t1", templateKey: "k", to: "a@b.co", email });
    const first = await deliver(store, provider, "t1", queued.id);
    const second = await deliver(store, provider, "t1", queued.id);
    expect(first.status).toBe("sent");
    expect(second.providerMessageId).toBe("m-1");
    expect(calls).toBe(1);
  });

  it("records a provider failure so it can be retried", async () => {
    const store = new MemoryStore();
    let fail = true;
    const provider: EmailProvider = {
      send: async () => {
        if (fail) throw new Error("throttled");
        return { messageId: "m-2" };
      },
    };
    const queued = await queueEmail(store, { tenantId: "t1", templateKey: "k", to: "a@b.co", email });
    const failed = await deliver(store, provider, "t1", queued.id);
    expect(failed).toMatchObject({ status: "failed", error: "throttled", attempts: 1 });
    fail = false;
    const retried = await deliver(store, provider, "t1", queued.id);
    expect(retried).toMatchObject({ status: "sent", attempts: 2 });
  });

  it("does not see another tenant's message", async () => {
    const store = new MemoryStore();
    const queued = await queueEmail(store, { tenantId: "t1", templateKey: "k", to: "a@b.co", email });
    await expect(deliver(store, { send: async () => ({ messageId: "x" }) }, "t2", queued.id)).rejects.toThrow(/not found/i);
  });
});

describe("SesEmailProvider", () => {
  it("builds the SES request and returns the message id", async () => {
    let input: any;
    const client = { send: async (cmd: any) => ((input = cmd.input), { MessageId: "ses-1" }) };
    const ses = new SesEmailProvider({ from: "noreply@qavrillabs.com", region: "us-east-1", configurationSet: "main", client: client as never });
    const res = await ses.send({ to: "a@b.co", email: { subject: "Hi", text: "Body", html: "<p>Body</p>" } });
    expect(res.messageId).toBe("ses-1");
    expect(input.FromEmailAddress).toBe("noreply@qavrillabs.com");
    expect(input.Destination.ToAddresses).toEqual(["a@b.co"]);
    expect(input.ConfigurationSetName).toBe("main");
    expect(input.Content.Simple.Body.Html.Data).toBe("<p>Body</p>");
  });

  it("fails when SES returns no message id", async () => {
    const client = { send: async () => ({}) };
    const ses = new SesEmailProvider({ from: "a@b.co", region: "us-east-1", client: client as never });
    await expect(ses.send({ to: "a@b.co", email: { subject: "s", text: "t" } })).rejects.toThrow(/MessageId/);
  });
});
