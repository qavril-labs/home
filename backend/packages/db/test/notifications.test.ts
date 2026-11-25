import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { newId } from "@erp/kernel";
import { deliver, queueEmail } from "@erp/notifications";
import { TenantService } from "@erp/tenancy";
import { PgNotificationStore, PgTenantRepository, withTenantTransaction } from "../src";
import { startTestDatabase, type TestDatabase } from "../src/testing/embedded";

describe("PgNotificationStore", () => {
  let db: TestDatabase;
  let store: PgNotificationStore;
  let tenantA: string;
  let tenantB: string;

  async function createTenant(slug: string): Promise<string> {
    const id = newId();
    await withTenantTransaction(db.appPool, id, async (tx) => {
      await new TenantService(new PgTenantRepository(tx)).createTenant({ slug, name: slug, region: "EU" }, id);
    });
    return id;
  }

  beforeAll(async () => {
    db = await startTestDatabase();
    store = new PgNotificationStore(db.appPool);
    tenantA = await createTenant("notif-a");
    tenantB = await createTenant("notif-b");
  }, 180_000);

  afterAll(async () => {
    await db?.stop();
  });

  it("queues, sends once and records the provider id", async () => {
    let calls = 0;
    const provider = { send: async () => (calls++, { messageId: "ses-9" }) };
    const queued = await queueEmail(store, {
      tenantId: tenantA,
      templateKey: "invoice.reminder",
      to: "a@b.co",
      email: { subject: "Hi", text: "Body", html: "<p>Body</p>" },
    });
    expect(queued.status).toBe("queued");
    const sent = await deliver(store, provider, tenantA, queued.id);
    await deliver(store, provider, tenantA, queued.id);
    expect(sent).toMatchObject({ status: "sent", providerMessageId: "ses-9", attempts: 1 });
    expect(sent.sentAt).not.toBeNull();
    expect(calls).toBe(1);
  });

  it("keeps a failure on the row", async () => {
    const queued = await queueEmail(store, { tenantId: tenantA, templateKey: "k", to: "a@b.co", email: { subject: "s", text: "t" } });
    const failed = await deliver(store, { send: async () => { throw new Error("boom"); } }, tenantA, queued.id);
    expect(failed).toMatchObject({ status: "failed", error: "boom", attempts: 1 });
  });

  it("hides one tenant's messages from another", async () => {
    const queued = await queueEmail(store, { tenantId: tenantA, templateKey: "k", to: "a@b.co", email: { subject: "s", text: "t" } });
    expect(await store.find(tenantB, queued.id)).toBeNull();
  });
});
